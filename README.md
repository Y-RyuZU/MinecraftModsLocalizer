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
- **Progress Tracking**: Real-time progress display with interrupt capability
- **Batch Processing**: Efficiently processes large mod packs with chunking

## Installation

Download the latest release for your platform from the [Releases](https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases) page:

- **Windows**: Download the `.exe` or `.msi` installer
- **macOS**: Download the `.dmg` file (Intel or Apple Silicon)
- **Linux**: Download the `.AppImage` or `.deb` package

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (1.77.2 or later)
- [Node.js](https://nodejs.org/) (20 or later)
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
# Run all tests
bun test

# Run with Jest
bun run test:jest

# Run with coverage
bun run test:coverage
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Code Rabbit
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Y-RyuZU/MinecraftModsLocalizer?utm_source=oss&utm_medium=github&utm_campaign=Y-RyuZU%2FMinecraftModsLocalizer&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.