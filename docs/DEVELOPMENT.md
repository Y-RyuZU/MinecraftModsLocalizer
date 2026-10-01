# Development guide

## Requirements

- Rust stable via [rustup](https://rustup.rs/)
- Node.js Active LTS and [Bun](https://bun.sh/)
- On Windows, WebView2 for running the desktop app and Microsoft Edge for the WebDriver tests

## Start the app

```powershell
bun install
bun run tauri dev
```

## Automated checks

Run the same local checks used by CI:

```powershell
bun run lint
bun run typecheck
bun run test
bun run test:jest
bun run test:vitest
bun run test:i18n
bun run build # Generate out/ before Rust checks with custom-protocol
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-features
cargo check --manifest-path src-tauri/Cargo.toml --all-features
```

The Bun suite uses fixtures and mocked model responses; it does not call a paid API or modify a Prism instance.

## Real provider smoke test

The smoke test sends two short strings to the selected provider, validates that the returned JSON has exactly the expected keys and string values, and prints the result—not the key. Provide a provider key through your own secret manager or the current PowerShell process; do not save it in the repository or a checked-in `.env` file.

```powershell
$env:MML_PROVIDER = "openai" # openai, anthropic, or gemini
# Make the matching provider key available to this process.
bun run test:translation:smoke
```

The app's **Load from environment** button reads the provider-specific variable (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` / `GOOGLE_API_KEY`). The smoke script also accepts `MML_API_KEY`; optionally set `MML_MODEL` and `MML_TARGET_LANGUAGE` to override its defaults.

## ATM10 SKY sample (writes only to a temporary copy)

This sample performs a small real translation of representative KubeJS JSON and FTB Quests SNBT inputs. It checks exact JSON keys and SNBT structure and writes to `%TEMP%` by default; it does not edit the live instance.

```powershell
$env:MML_ATM10_ROOT = "C:\path\to\ATM10SKY\minecraft"
bun run test:translation:atm10-sample
```

Set `MML_SAMPLE_OUTPUT` only if you want to choose a different output directory. Review the generated files before using them in a game instance.

## Desktop end-to-end tests

The WebDriver test launches the built Tauri executable and uses the app's saved instance profile. It does not require Computer Use. Build a local debug app without updater signing first:

```powershell
bun x tauri build --debug --no-bundle --config '{"bundle":{"createUpdaterArtifacts":false}}'
$env:MML_E2E_APP_BINARY = (Resolve-Path "src-tauri\target\debug\app.exe").Path
```

`bun run test:e2e` is scan-only by default: it scans Mods, Quests, Guidebooks, and Custom Files, and checks the replace opt-in UI without making an API request or writing translations. Set `MML_CATEGORIES` to a comma-separated subset if a full Custom Files scan is too broad, for example `Mods,Quests`.

`bun run test:e2e:atm10` explicitly enables real translation. It defaults to all four categories, selects every eligible target, and writes results to the instance configured in the app. For the main ATM10 SKY goal, limit it to Mods and Quests before running:

```powershell
$env:MML_CATEGORIES = "Mods,Quests"
$env:MML_CHUNK_SIZE = "100"
$env:MML_QUEST_CHUNK_SIZE = "25"
# Optional: opt into the provider's asynchronous Batch API. It is off unless set.
$env:MML_USE_BATCH_API = "1"
bun run test:e2e:atm10
```

This test uses OpenAI `gpt-6-luna`, expects `OPENAI_API_KEY` in the app process, can take a long time, incurs provider charges, and changes the selected instance. Run it against a backed-up copy. Existing Japanese files are skipped unless a specific mod ID is listed in `MML_FORCE_MOD_IDS`; completed or intentionally excluded mod IDs can be listed in `MML_SKIP_COMPLETED_MOD_IDS` when resuming. Inspect the resource pack and quest outputs after the run; a green UI result alone is not a file-format audit.
