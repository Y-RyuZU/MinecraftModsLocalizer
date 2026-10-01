#!/usr/bin/env python3
"""Validate downloaded CI bundles and stage a flat release directory. Never publish."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import plistlib
import shutil
import struct
import tarfile
import tomllib
from datetime import datetime, timezone
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
TARGETS = {
    "windows-x86_64": ("x86_64-pc-windows-msvc", ".msi", (".msi", ".exe")),
    "darwin-x86_64": ("x86_64-apple-darwin", ".app.tar.gz", (".app.tar.gz", ".dmg")),
    "darwin-aarch64": ("aarch64-apple-darwin", ".app.tar.gz", (".app.tar.gz", ".dmg")),
    "linux-x86_64": ("x86_64-unknown-linux-gnu", ".AppImage", (".AppImage", ".deb")),
}


def check_versions(tag=None, root=ROOT):
    versions = [json.loads((root / name).read_text(encoding="utf-8"))["version"]
                for name in ("package.json", "src-tauri/tauri.conf.json")]
    for name in ("src-tauri/Cargo.toml", "src-tauri/Cargo.lock"):
        data = tomllib.loads((root / name).read_text(encoding="utf-8"))
        package = data["package"]
        if isinstance(package, list):
            package = next(p for p in package if p["name"] == "app")
        versions.append(package["version"])
    if len(set(versions)) != 1 or (tag and tag != f"v{versions[0]}"):
        raise ValueError(f"Version mismatch: {versions}, tag={tag}")
    return versions[0]


def check_mac_bundle(bundle, platform, version):
    # Read archive members without extracting any paths to disk.
    with tarfile.open(bundle) as archive:
        plists = [m for m in archive.getmembers() if m.name.endswith(".app/Contents/Info.plist")]
        if len(plists) != 1:
            raise ValueError(f"Expected one app Info.plist: {bundle}")
        info = plistlib.loads(archive.extractfile(plists[0]).read())
        if info.get("CFBundleShortVersionString") != version:
            raise ValueError(f"Wrong macOS app version: {bundle}")
        binary = plists[0].name.removesuffix("Info.plist") + "MacOS/" + info["CFBundleExecutable"]
        header = archive.extractfile(binary).read(8)
        cpu = 0x01000007 if platform == "darwin-x86_64" else 0x0100000C
        if header != struct.pack("<II", 0xFEEDFACF, cpu):
            raise ValueError(f"Wrong Mach-O architecture for {platform}: {bundle}")


def prepare(artifacts, output, repository, tag):
    version = check_versions(tag)
    if output.exists() and any(output.iterdir()):
        raise ValueError(f"Output must be empty (avoid stale release assets): {output}")
    assets, platforms = [], {}
    for platform, (target, updater_suffix, suffixes) in TARGETS.items():
        directory = artifacts / f"minecraft-mods-localizer-{target}"
        for suffix in suffixes:
            matches = sorted(p for p in directory.rglob("*") if p.is_file() and p.name.endswith(suffix))
            if len(matches) != 1:
                raise ValueError(f"Expected one {suffix} for {target}, found {len(matches)}")
            bundle = matches[0]
            if suffix != ".app.tar.gz" and f"_{version}_" not in bundle.name:
                raise ValueError(f"Wrong installer version: {bundle}")
            if suffix == ".dmg":
                arch = "x64" if platform == "darwin-x86_64" else "aarch64"
                if not bundle.name.endswith(f"_{arch}.dmg"):
                    raise ValueError(f"Wrong DMG architecture for {platform}: {bundle}")
            if suffix == ".app.tar.gz":
                check_mac_bundle(bundle, platform, version)
            name = bundle.name.removesuffix(suffix) + f"-{target}" + suffix
            assets.append((bundle, name))
            signature_file = Path(f"{bundle}.sig")
            if signature_file.is_file():
                assets.append((signature_file, name + ".sig"))
            if suffix == updater_suffix:
                signature = signature_file.read_text(encoding="utf-8").strip()
                # Tauri signatures contain base64-encoded minisign text, never a URL.
                decoded = base64.b64decode(signature, validate=True)
                if not decoded.startswith(b"untrusted comment:"):
                    raise ValueError(f"Invalid Tauri signature format: {signature_file}")
                platforms[platform] = {
                    "url": f"https://github.com/{repository}/releases/download/{quote(tag, safe='')}/{quote(name, safe='')}",
                    "signature": signature,
                }
    names = [name for _, name in assets]
    if len(set(names)) != len(names):
        raise ValueError("Duplicate release asset names")
    output.mkdir(parents=True, exist_ok=True)
    for source, name in assets:
        shutil.copy2(source, output / name)
    manifest = {
        "version": version, "notes": f"Minecraft Mods Localizer {version}",
        "pub_date": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "platforms": platforms,
    }
    (output / "latest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    checksums = []
    for asset in sorted(output.iterdir()):
        with asset.open("rb") as stream:
            checksums.append(f"{hashlib.file_digest(stream, 'sha256').hexdigest()}  {asset.name}\n")
    (output / "SHA256SUMS.txt").write_text("".join(checksums), encoding="utf-8")
    print(f"Prepared {len(assets)} assets, latest.json and SHA256SUMS.txt in {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-version", action="store_true")
    parser.add_argument("--artifacts", type=Path, default=Path("artifacts"))
    parser.add_argument("--output", type=Path, default=Path("release-assets"))
    parser.add_argument("--repository", default="Y-RyuZU/MinecraftModsLocalizer")
    parser.add_argument("--tag")
    args = parser.parse_args()
    if args.check_version:
        print(check_versions(args.tag))
    else:
        if not args.tag:
            parser.error("--tag is required")
        prepare(args.artifacts, args.output, args.repository, args.tag)
