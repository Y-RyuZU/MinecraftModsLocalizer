# Tauri updater and release signing

## Certificates and updater signatures are different

A purchased Windows code-signing certificate or Apple notarization is not a prerequisite for this release. The Tauri updater signature described here uses the existing public/private key pair, without a purchased certificate. Keep it enabled for automatic updates. Installers without OS code signing can still have updater verification signatures.


The desktop app uses Tauri's signed updater. Its configured endpoint is the `latest.json` asset on the latest **published** GitHub Release. The updater checks the signature against the public key in `src-tauri/tauri.conf.json` before installing an update.

## Required signing setup

`src-tauri/tauri.conf.json` enables `bundle.createUpdaterArtifacts` and contains the updater **public** key. The matching private key must never be committed or shipped with the app. The release workflow expects these GitHub Actions secrets:

- `TAURI_PRIVATE_KEY`: the contents of the Tauri updater signing private key. A local file path only works if that file also exists on the GitHub Actions runner.
- `TAURI_KEY_PASSWORD`: its password, or an empty value when the key has no password

If the signing key is lost or replaced, already-installed copies that trust the old public key will not accept updates signed by the new key. Keep a secure backup and do not rotate it casually.

This repository already has its updater public key in `tauri.conf.json`. Do not generate or substitute a key for a normal release; the private key secret must match that existing public key. For a new app/key lineage, `bunx tauri signer generate -w <private-key-file>` creates a key pair, and the generated public key must be configured in Tauri. Changing this repository's public key is a user migration, not routine setup.

## Release flow

1. Keep `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the app entry in `src-tauri/Cargo.lock` in sync. Run `python scripts/prepare-release.py --check-version` (Python 3.11+).
2. Push a `v*` tag. GitHub Actions builds each platform with the signing secrets and collects the installer files plus Tauri updater signatures.
3. The release job creates `latest.json` from those artifacts. It embeds each `.sig` file's contents (not a link to the `.sig` file) and maps the correct bundle to `windows-x86_64`, `darwin-x86_64`, `darwin-aarch64`, and `linux-x86_64`.
4. Inspect the draft release: it must contain the platform installers, updater bundles/signatures, and `latest.json`. Publish only after all platform entries are present.

The update endpoint serves the latest published release, so draft releases are intentionally invisible to users. Windows updater packages use the signed MSI; macOS uses the signed `.app.tar.gz`; Linux uses the signed AppImage. The ordinary installer downloads remain available alongside the updater files.

The in-app update prompt gets the installed version from Tauri at runtime. Development/browser builds fall back to the frontend package version; auto-install is disabled in Tauri debug mode.

## Rehearse before publishing

The workflow passes the Rust target through `tauri-action`'s `args: --target ...`, builds `app,dmg` on macOS, and uploads from `src-tauri/target/<target>/release/bundle`. `target` is not a supported standalone action input. See the [action inputs](https://github.com/tauri-apps/tauri-action/blob/v0/action.yml) and [Tauri updater guide](https://v2.tauri.app/plugin/updater/).

Download artifacts from the candidate's successful CI run and stage them locally:

```sh
gh run download <run-id> --dir artifacts
python scripts/prepare-release.py --tag v3.0.0 --artifacts artifacts --output release-assets
python -m unittest discover -s scripts -p 'test_*.py'
```

The staging script checks versions, required installers, updater signatures, and the macOS executable's CPU architecture. It rejects missing/duplicate bundles and nonempty output directories. It creates unique asset names, `latest.json`, and `SHA256SUMS.txt`. The obsolete unsigned placeholder manifest generator has been removed. Signature format checks in the script **do not verify cryptographic authenticity**; the real updater installation must verify against the configured public key.

Before release approval, install and launch each platform build, perform one small translation, test update installation from an older Tauri build using the same public key, and verify that a tampered artifact is rejected. A draft asset requires authentication and is not usable by the public updater endpoint. Use a controlled test endpoint/build for the upgrade rehearsal; do not change the production public key. Record the tested source version, target version, CPU, result, and source commit in the [release checklist](release-readiness-v3.md).

The public v2.1.3 release predates this Tauri delivery flow and has no `latest.json`. Do not promise automatic migration from v2.1.3; document a manual installer path until that migration is verified. Tauri updater signing is separate from OS installer signing/notarization.

## Verify downloads

Download `SHA256SUMS.txt` and the required asset from the **same** release. In PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '.\<downloaded-installer>.exe'
```

Compare the hash with the line for that exact filename in `SHA256SUMS.txt`. On Linux, after downloading all listed assets, run `sha256sum -c SHA256SUMS.txt`; on macOS use `shasum -a 256 -c SHA256SUMS.txt`. Missing files are reported if you downloaded only a subset. Checksums detect corruption; they do not replace Tauri signature verification.

The draft release body comes from `docs/releases/<tag>.md`. Write that version's notes before pushing a new tag. Publishing, tag pushes, workflow dispatch, and external announcements require the maintainer's explicit approval in this preparation task.
