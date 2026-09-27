# Minecraft Mods Localizer

[English](README.md) | [日本語](README.ja.md)

[![Build and Release](https://github.com/Y-RyuZU/MinecraftModsLocalizer/actions/workflows/build.yml/badge.svg)](https://github.com/Y-RyuZU/MinecraftModsLocalizer/actions/workflows/build.yml)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/Y-RyuZU/MinecraftModsLocalizer)](https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases/latest)
[![License](https://img.shields.io/github/license/Y-RyuZU/MinecraftModsLocalizer)](LICENSE)

A cross-platform desktop app for AI-powered Minecraft mod and modpack localization. Translate mod language files, FTB Quests, Patchouli guidebooks, and supported JSON/SNBT files into Japanese or another target language. Built with Tauri, Rust, and TypeScript.

## Features

- **Mod Translation**: Translates mod language files and outputs them as resource packs
- **Quest Translation**: Supports FTB Quests and Better Quests translation
  - Supports multiple FTB Quest directory structures:
    - Standard: `config/ftbquests/quests/`
    - FTB Interactions Remastered: `config/ftbquests/normal/`
    - Nested categories and deeply nested quest structures
- **Patchouli Guidebook Translation**: Translates Patchouli guidebooks within mod JAR files
- **Multi-Language Support**: Built-in targets include Japanese, Simplified Chinese, Korean, German, French, Spanish, Italian, Brazilian Portuguese, and Russian; custom language IDs are supported too
- **AI-Powered**: Uses advanced language models for high-quality translations
- **Provider Choice**: Connect your own OpenAI, Anthropic, or Google Gemini API key
- **Signed Updates**: Tauri's updater verifies signed update artifacts before installation
- **Progress Tracking**: Real-time progress display with interrupt capability
- **Batch Processing**: Efficiently processes large mod packs with chunking

The application interface is currently available in English and Japanese. Translation output is not limited to those UI languages; you can select a built-in or custom Minecraft language.

## Installation

Download the latest release for your platform from the [Releases](https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases) page:

- **Windows**: Download the `.exe` or `.msi` installer
- **macOS**: Download the `.dmg` file (Intel or Apple Silicon)
- **Linux**: Download the `.AppImage` or `.deb` package

To translate with an AI provider, create your own API key and enter it in **Settings → LLM Settings**. [OpenAI key setup](docs/api-key-setup.md) · [日本語ガイド](docs/ja/api-key-setup.md)

API usage is billed by the provider and is separate from ChatGPT subscriptions. The key is never embedded in the app. In the current version, a key entered in Settings is saved in the local application `config.json` without OS-keychain encryption; protect your OS user account and do not share or sync that file. See the [API key security guide](docs/api-key-setup.md#where-the-key-is-stored).

The app checks for published releases and installs updates only after Tauri verifies their signatures. See [Updater and release maintenance](docs/updater.md) if you maintain this project.

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (1.90 or later)
- [Node.js](https://nodejs.org/) (24 LTS)
- [Bun](https://bun.sh/) (latest version)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/Y-RyuZU/MinecraftModsLocalizer.git
cd MinecraftModsLocalizer
```

2. Install dependencies:
```bash
bun install
```

3. Run in development mode:
```bash
bun run tauri dev
```

### Building

To build the application for your current platform:

```bash
bun run tauri build
```

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment.

### Workflows

1. **Build and Release** (`build.yml`)
   - Triggered on pushes to main, tags, and pull requests
   - Runs tests, linting, and type checking
   - Builds release artifacts for Windows, macOS (Intel & ARM), and Linux (PR validation runs separately)
   - Creates draft releases for version tags

2. **PR Validation** (`pr-validation.yml`)
   - Validates pull requests with linting, formatting, and tests
   - Runs security scans with cargo audit

3. The release job includes Tauri-signed updater artifacts and generates the platform `latest.json` before creating a draft release.

### Release Process

1. Update version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`
2. Commit and push changes
3. Create and push a version tag:
   ```bash
   git tag v3.0.1
   git push origin v3.0.1
   ```
4. GitHub Actions builds installers, updater bundles and signatures, then creates a draft release containing `latest.json`
5. Verify the draft assets and manifest, edit release notes, and publish. The in-app updater will only see a published release.

Release signing setup and checks are documented in [docs/updater.md](docs/updater.md).

## Testing

Run the test suite:

```bash
# Run all tests
bun test

# Run with Jest
bun run test:jest

# Run with coverage
bun run test:coverage
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

You can help make the app easier to discover and use worldwide by contributing a README or UI translation. The source of truth for interface strings is `public/locales/en/common.json`; existing Japanese translations are in `public/locales/ja/common.json`.

## Code Rabbit
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Y-RyuZU/MinecraftModsLocalizer?utm_source=oss&utm_medium=github&utm_campaign=Y-RyuZU%2FMinecraftModsLocalizer&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
