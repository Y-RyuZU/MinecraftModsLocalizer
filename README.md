# Minecraft Mods Localizer

[![Build and Release](https://github.com/Y-RyuZU/MinecraftModsLocalizer/actions/workflows/build.yml/badge.svg)](https://github.com/Y-RyuZU/MinecraftModsLocalizer/actions/workflows/build.yml)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/Y-RyuZU/MinecraftModsLocalizer)](https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases/latest)
[![License](https://img.shields.io/github/license/Y-RyuZU/MinecraftModsLocalizer)](LICENSE)

A desktop application that automates the translation of Minecraft Mods and Quests using AI-powered translation services.

## Features

- **Mod Translation**: Translates mod language files and outputs them as resource packs
- **Quest Translation**: Supports FTB Quests and Better Quests translation
- **Patchouli Guidebook Translation**: Translates Patchouli guidebooks within mod JAR files
- **Multi-Language Support**: Supports Japanese, Chinese, Korean, German, French, Spanish, and custom languages
- **AI-Powered**: Uses advanced language models for high-quality translations
- **Provider Choice**: Select OpenAI, Anthropic, or Google Gemini independently
- **Easy Key Setup**: Open the provider console, load a key from a Windows environment variable, or inject it at runtime from 1Password
- **Progress Tracking**: Real-time progress display with interrupt capability
- **Batch Processing**: Efficiently processes large mod packs with chunking

## Installation

Download the latest release for your platform from the [Releases](https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases) page:

- **Windows**: Download the `.exe` or `.msi` installer
- **macOS**: Download the `.dmg` file (Intel or Apple Silicon)
- **Linux**: Download the `.AppImage` or `.deb` package

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [Node.js](https://nodejs.org/) (LTS)
- [Bun](https://bun.sh/) (latest version)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/Y-RyuZU/MinecraftModsLocalizer.git
cd MinecraftModsLocalizer
```

2. Install dependencies:
```bash
npm install
```

3. Run in development mode:
```bash
npm run tauri dev
```

### API keys

The Settings screen has a provider-specific API key field. Use **Get API key** to open the official console, or set one of these Windows environment variables and choose **Load from environment**:

- [OpenAI API keys](https://platform.openai.com/api-keys): `OPENAI_API_KEY`
- [Anthropic API keys](https://console.anthropic.com/settings/keys): `ANTHROPIC_API_KEY`
- [Google AI Studio keys](https://aistudio.google.com/app/apikey): `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)

For a real two-entry translation smoke test from PowerShell (the key is kept only in the current process):

```powershell
npm run test:translation:smoke
```

For another adapter, set `$env:MML_PROVIDER` to `anthropic` or `gemini` and set the matching provider variable. Never commit API keys or include them in logs.

For 1Password CLI, keep only a secret reference in a temporary file outside the repository:

On Windows, first unlock the 1Password desktop app and enable **Settings > Developer > Integrate with 1Password CLI**. Then use `op vault list` to confirm the CLI session.

```powershell
@"
MML_PROVIDER=gemini
MML_API_KEY=op://Private/<item-name>/credential
"@ | Set-Content -Path (Join-Path $env:TEMP "mml-gemini.env") -Encoding ascii

op run --env-file=(Join-Path $env:TEMP "mml-gemini.env") -- npm run test:translation:smoke
```

`op run` resolves the reference only for the child process; the key is not written to the repository or printed by the smoke test. The Settings screen can use the same process-scoped variable with **Load from environment**. In the packaged Tauri app, **Save Settings** stores provider keys in the Windows Credential Manager and keeps them out of `config.json`; **Load from environment** is still the most ephemeral option for a one-off smoke test.

### Building

To build the application for your current platform:

```bash
npm run tauri build
```

For a local unsigned Windows installer (no updater signing key required):

```powershell
npm run tauri build -- --debug --config '{"bundle":{"createUpdaterArtifacts":false}}'
```

Release builds that publish updater artifacts require `TAURI_SIGNING_PRIVATE_KEY`; the repository configuration contains only the public key.

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment.

### Workflows

1. **Build and Release** (`build.yml`)
   - Triggered on pushes to main, tags, and pull requests
   - Runs tests, linting, and type checking
   - Builds for Windows, macOS (Intel & ARM), and Linux
   - Creates draft releases for version tags

2. **PR Validation** (`pr-validation.yml`)
   - Validates pull requests with linting, formatting, and tests
   - Runs security scans with cargo audit

3. **Update Manifest** (`update-manifest.yml`)
   - Generates `latest.json` for the Tauri updater when releases are published

### Release Process

1. Update version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`
2. Commit and push changes
3. Create and push a version tag:
   ```bash
   git tag v3.0.1
   git push origin v3.0.1
   ```
4. GitHub Actions will build and create a draft release
5. Edit the release notes and publish

## Testing

Run the test suite:

```bash
# Run the Bun test suite
npm test

# Run a real provider translation (requires an API key)
npm run test:translation:smoke

# Run with Jest
bun run test:jest

# Run with coverage
bun run test:coverage
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
