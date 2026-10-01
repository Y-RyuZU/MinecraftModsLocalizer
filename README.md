# Minecraft Mods Localizer

[![Build and Release](https://github.com/Y-RyuZU/MinecraftModsLocalizer/actions/workflows/build.yml/badge.svg)](https://github.com/Y-RyuZU/MinecraftModsLocalizer/actions/workflows/build.yml)
[![GitHub release](https://img.shields.io/github/v/release/Y-RyuZU/MinecraftModsLocalizer)](https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases/latest)
[![License](https://img.shields.io/github/license/Y-RyuZU/MinecraftModsLocalizer)](LICENSE)

Minecraft Mods Localizer (MML) is a desktop app for translating Minecraft modpacks with AI. It supports mod language files, quests, Patchouli guidebooks, and selected custom files, using OpenAI, Anthropic, or Google Gemini.

## Install

Download the installer for your platform from [GitHub Releases](https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases):

- Windows: `.exe` or `.msi`
- macOS: `.dmg` (Intel or Apple Silicon)
- Linux: `.AppImage` or `.deb`

Release assets include a `SHA256SUMS` file. On Windows, choose either installer format; do not run both over one installation.

See [CHANGELOG.md](CHANGELOG.md) for the current release-candidate changes.

## Translate an instance

1. In Settings, select the instance's `minecraft` directory—the folder containing `mods`, `config`, and `resourcepacks`.
2. Open Mods, Quests, Guidebooks, or Custom Files, choose the target language, scan, select targets, and translate.
3. Mod language files are written as a resource pack under the instance's `resourcepacks` directory. Enable the generated pack in Minecraft's Resource Packs menu if it is not already active.

Quest files that support locales are written in the matching target-language layout. Legacy inline SNBT formats are edited in place only after a backup is created (`.mml-original.bak`). Existing Japanese translations are normally skipped. Re-translation is an explicit per-target opt-in; check the displayed backup behavior before enabling it.

The provider-native asynchronous Batch API is separately opt-in for each supported provider. It can take longer to return results; normal synchronous requests remain the default. API usage and pricing are controlled by the provider account.

## API keys

Use **Get API key** in Settings to open the selected provider's key page, or paste a key into that provider's field. **Load from environment** reads the key only for the current app process; **Save Settings** stores it through the operating system's credential store. Never commit keys or put them in issue reports or logs.

- [OpenAI API keys](https://platform.openai.com/api-keys) — `OPENAI_API_KEY`
- [Anthropic API keys](https://console.anthropic.com/settings/keys) — `ANTHROPIC_API_KEY`
- [Google AI Studio API keys](https://aistudio.google.com/app/apikey) — `GEMINI_API_KEY` or `GOOGLE_API_KEY`

## Development and testing

Development prerequisites and commands are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). The current automated test inventory and the distinction between mock, scan-only, and real-API tests are in [docs/TESTING.md](docs/TESTING.md).

## Reporting an issue

Please include the app version, operating system, translation category, and relevant sanitized log entries. Do not attach API keys, private pack files, or unredacted personal paths. Report problems at [GitHub Issues](https://github.com/Y-RyuZU/MinecraftModsLocalizer/issues).

## License

MIT; see [LICENSE](LICENSE).
