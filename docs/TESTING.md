# Testing

Tests are divided into offline parser/translation logic, a read-only desktop scan, and an explicitly requested real-API translation. Only the last category uses a paid provider or writes translated files.

## Offline tests

```powershell
bun install
bun run lint
bun run typecheck
bun run test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-features
cargo check --manifest-path src-tauri/Cargo.toml --all-features
```

The Bun tests use mocked model responses and fixture files. They cover JSON language files, legacy `.lang`, FTB Quests SNBT (inline, flat locale, split, and merged forms), BetterQuesting data, Patchouli components, exact key preservation, output paths, and malformed-response retries. They do not call provider APIs or edit Prism instances.

## Desktop scan test

See [DEVELOPMENT.md](DEVELOPMENT.md#desktop-end-to-end-tests) for building the Tauri test binary. The ordinary command is deliberately scan-only:

```powershell
bun run test:e2e
```

It launches the desktop app through WebDriver, scans all four tabs by default, checks existing Japanese locale/replace UI behavior, and does not translate or write output. Limit scans with `MML_CATEGORIES=Mods,Quests` (PowerShell: `$env:MML_CATEGORIES = "Mods,Quests"`) when Custom Files would include unrelated files.

## Real API / instance test

```powershell
$env:MML_CATEGORIES = "Mods,Quests"
bun run test:e2e:atm10
```

This command explicitly opts into the OpenAI-backed translation flow (`gpt-6-luna`) and writes to the instance selected in the app. It can take hours and incur API charges. Test on a backed-up copy. The script can opt into OpenAI Batch with `MML_USE_BATCH_API=1`; Batch is off otherwise. Set `MML_FORCE_MOD_IDS` only for selected mods whose existing locale should be replaced, and audit the resulting files independently after completion.

For a smaller API check that does not touch a pack, use `bun run test:translation:smoke`; it sends two sample strings and verifies the response's exact key set and string values.

## Release artifact checks

The release workflow validates version consistency and runs the unit, Rust, lint, and type checks before building. After a draft is generated, inspect all installer and updater assets, verify `SHA256SUMS`, and confirm `latest.json` contains a non-empty signature and working download URL for each target before publishing. See [ci-cd.md](ci-cd.md) for the release checklist.
