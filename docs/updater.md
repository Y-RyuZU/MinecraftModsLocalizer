# Tauri updater and release signing

The desktop app uses Tauri's signed updater. Its configured endpoint is the `latest.json` asset on the latest **published** GitHub Release. The updater checks the signature against the public key in `src-tauri/tauri.conf.json` before installing an update.

## Required signing setup

`src-tauri/tauri.conf.json` enables `bundle.createUpdaterArtifacts` and contains the updater **public** key. The matching private key must never be committed or shipped with the app. The release workflow expects these GitHub Actions secrets:

- `TAURI_PRIVATE_KEY`: the contents of the Tauri updater signing private key. A local file path only works if that file also exists on the GitHub Actions runner.
- `TAURI_KEY_PASSWORD`: its password, or an empty value when the key has no password

If the signing key is lost or replaced, already-installed copies that trust the old public key will not accept updates signed by the new key. Keep a secure backup and do not rotate it casually.

This repository already has its updater public key in `tauri.conf.json`. Do not generate or substitute a key for a normal release; the private key secret must match that existing public key. For a new app/key lineage, `bunx tauri signer generate -w <private-key-file>` creates a key pair, and the generated public key must be configured in Tauri. Changing this repository's public key is a user migration, not routine setup.

## Release flow

1. Update the version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`.
2. Push a `v*` tag. GitHub Actions builds each platform with the signing secrets and collects the installer files plus Tauri updater signatures.
3. The release job creates `latest.json` from those artifacts. It embeds each `.sig` file's contents (not a link to the `.sig` file) and maps the correct bundle to `windows-x86_64`, `darwin-x86_64`, `darwin-aarch64`, and `linux-x86_64`.
4. Inspect the draft release: it must contain the platform installers, updater bundles/signatures, and `latest.json`. Publish only after all platform entries are present.

The update endpoint serves the latest published release, so draft releases are intentionally invisible to users. Windows updater packages use the signed MSI; macOS uses the signed `.app.tar.gz`; Linux uses the signed AppImage. The ordinary installer downloads remain available alongside the updater files.

The in-app update prompt gets the installed version from Tauri at runtime. Development/browser builds fall back to the frontend package version; auto-install is disabled in Tauri debug mode.
