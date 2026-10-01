# CI and release process

## Workflows

- `.github/workflows/pr-validation.yml` runs on pull requests. It installs Bun and stable Rust, checks Rust formatting and Clippy, runs TypeScript lint/type checks and Bun tests, and checks the Tauri Rust build.
- `.github/workflows/build.yml` runs on pushes to `main`, `v*` tags, and manual dispatch. Its test job verifies that `package.json`, `Cargo.toml`, and `tauri.conf.json` versions agree, then runs the full checks. Four build jobs produce Linux x86_64, macOS Intel, macOS Apple Silicon, and Windows x86_64 artifacts.
- `.github/workflows/update-manifest.yml` runs after a release is published. It downloads the signed update bundles and creates the Tauri `latest.json` manifest with each bundle URL and the matching signature text.

## Required repository secrets

- `TAURI_PRIVATE_KEY`: private updater-signing key contents. Keep it in GitHub Actions secrets; never commit or expose it.
- `TAURI_KEY_PASSWORD`: password for that key (an empty value is valid if the key has no password).

These sign Tauri updater artifacts. They are not Windows Authenticode or Apple Developer signing credentials. Without platform signing/notarization, Windows SmartScreen and macOS Gatekeeper may show warnings.

## Release checklist

1. Merge the intended release commit into the current `main`; do not release directly from an old or divergent feature branch.
2. Set the same SemVer version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`. CI rejects mismatches and tags that do not equal `v<version>`.
3. Run the checks from [TESTING.md](TESTING.md#offline-tests), review the changelog, and verify any open issue that the release claims to fix.
4. Push the `v<version>` tag from the merged commit. GitHub Actions builds the installers and updater bundles, then creates a draft release with SHA-256 checksums.
5. Inspect the draft assets and test at least one install per supported OS. Run `sha256sum -c SHA256SUMS` on macOS/Linux, or compare `Get-FileHash -Algorithm SHA256 <file>` on Windows with the matching line.
6. Confirm `latest.json` contains a valid URL and non-empty signature for `windows-x86_64`, `darwin-x86_64`, `darwin-aarch64`, and `linux-x86_64`. Publish only after these checks pass.
7. The publish event generates and uploads `latest.json`. Verify the uploaded manifest and updater download URLs after the workflow completes.

The workflow uses the MSI as the Windows updater target, AppImage on Linux, and architecture-specific `.app.tar.gz` bundles on macOS. macOS updater archives are renamed per architecture so their signatures and release assets cannot collide. Installer formats such as `.dmg` and `.deb` are also attached but are not updater payloads.

## Local build

```powershell
bun install
bun x tauri build --debug --no-bundle --config '{"bundle":{"createUpdaterArtifacts":false}}'
```

Release updater builds require the private signing key. Never substitute a public key for `TAURI_PRIVATE_KEY`; the public key in `tauri.conf.json` is only for verifying downloaded updates.
