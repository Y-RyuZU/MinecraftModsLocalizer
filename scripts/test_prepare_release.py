import base64
import importlib.util
import io
import json
from pathlib import Path
import plistlib
import struct
import tarfile
import tempfile
import unittest
from urllib.parse import unquote

spec = importlib.util.spec_from_file_location("release", Path(__file__).with_name("prepare-release.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.output = self.root / "output"
        self.version = release.check_versions()
        for platform, (target, updater, suffixes) in release.TARGETS.items():
            directory = self.root / f"minecraft-mods-localizer-{target}"
            directory.mkdir()
            for suffix in suffixes:
                arch = "aarch64" if "aarch64" in platform else "x64"
                bundle = directory / f"app_{self.version}_{arch}{suffix}"
                if suffix == ".app.tar.gz":
                    with tarfile.open(bundle, "w:gz") as archive:
                        entries = {
                            "app.app/Contents/Info.plist": plistlib.dumps({"CFBundleShortVersionString": self.version, "CFBundleExecutable": "app"}),
                            "app.app/Contents/MacOS/app": struct.pack("<II", 0xFEEDFACF, 0x0100000C if arch == "aarch64" else 0x01000007),
                        }
                        for name, content in entries.items():
                            info = tarfile.TarInfo(name)
                            info.size = len(content)
                            archive.addfile(info, io.BytesIO(content))
                else:
                    bundle.write_bytes(b"fixture")
                if suffix == updater:
                    Path(f"{bundle}.sig").write_text(base64.b64encode(b"untrusted comment: test fixture\n").decode())

    def prepare(self):
        release.prepare(self.root, self.output, "owner/repo", f"v{self.version}")

    def test_manifest_urls_and_checksums_cover_staged_assets(self):
        self.prepare()
        manifest = json.loads((self.output / "latest.json").read_text())
        self.assertEqual(set(manifest["platforms"]), set(release.TARGETS))
        for entry in manifest["platforms"].values():
            bundle = self.output / unquote(entry["url"].rsplit("/", 1)[1])
            self.assertTrue(bundle.is_file())
            self.assertEqual(entry["signature"], Path(f"{bundle}.sig").read_text())
        for line in (self.output / "SHA256SUMS.txt").read_text().splitlines():
            digest, name = line.split("  ", 1)
            self.assertEqual(digest, release.hashlib.sha256((self.output / name).read_bytes()).hexdigest())
        self.assertEqual(len(list(self.output.iterdir())) - 1, len((self.output / "SHA256SUMS.txt").read_text().splitlines()))

    def test_missing_mac_updater_fails_before_staging(self):
        next(self.root.rglob("*.app.tar.gz")).unlink()
        with self.assertRaisesRegex(ValueError, "Expected one"):
            self.prepare()
        self.assertFalse(self.output.exists())

    def test_wrong_mac_cpu_fails(self):
        arm = next((self.root / "minecraft-mods-localizer-aarch64-apple-darwin").glob("*.app.tar.gz"))
        intel = next((self.root / "minecraft-mods-localizer-x86_64-apple-darwin").glob("*.app.tar.gz"))
        intel.write_bytes(arm.read_bytes())
        with self.assertRaisesRegex(ValueError, "architecture"):
            self.prepare()

    def test_missing_signature_fails(self):
        next(self.root.rglob("*.msi.sig")).unlink()
        with self.assertRaises(FileNotFoundError):
            self.prepare()

    def test_wrong_tag_and_stale_output_fail(self):
        with self.assertRaisesRegex(ValueError, "Version mismatch"):
            release.check_versions("v0.0.0")
        self.output.mkdir()
        (self.output / "old.exe").touch()
        with self.assertRaisesRegex(ValueError, "Output must be empty"):
            self.prepare()


if __name__ == "__main__":
    unittest.main()
