# Your first translation

[English](getting-started.md) | [日本語](ja/getting-started.md) | [README](../README.md)

This guide describes the v3 desktop interface. Choose the content you want to read: [quests](#translate-a-packs-quests), [mod names](#prepare-a-small-first-run), or [guidebooks](#translate-a-guidebook). Try one target and check it in Minecraft before increasing the selection. The browser preview cannot read your Minecraft files; use the installed desktop app.

## Install the right download

Open the [v3 download page](https://github.com/Y-RyuZU/MinecraftModsLocalizer/releases/tag/v3.0.0) and expand Assets. Use the installed desktop app. The app header’s **How to use** button opens this guide.

| System | v3 download |
| --- | --- |
| Windows x64 | `.exe` installer, or `.msi` |
| Mac with Apple Silicon | `.dmg` containing `aarch64-apple-darwin` |
| Mac with Intel CPU | `.dmg` containing `x86_64-apple-darwin` |
| Linux x64 | `.AppImage`, or `.deb` for Debian/Ubuntu |

The `.sig`, `latest.json`, and `.app.tar.gz` files serve the updater. For an ordinary installation, choose an installer from the table. The v3 release includes `SHA256SUMS.txt` for checking downloads; see the [verification commands](updater.md#verify-downloads).

The Windows `.exe` installer automatically uses the OS language from the ten bundled languages (English fallback). The `.msi` installer remains English. On first launch, MML selects a supported language from the OS preferences, falling back to English. The header language selector saves your choice for subsequent launches; existing saved choices are preserved. This controls the app interface, independently of the translation target language.

## Prepare a small first run

1. Back up your Minecraft instance and close the game. Choose a small mod with untranslated English language entries.
2. Get an API key from your chosen provider using the [key setup guide](api-key-setup.md). API usage can incur charges. Check the model's availability in your provider account; old saved model names can stop working when a provider retires them.
3. Open the gear button **Settings**, choose **LLM Settings**, then set the provider, API key, and model. Click **Save Settings**. Saving settings does not test the key or confirm billing access.
4. In **Mods**, click **Select Profile**. Select the actual game folder containing `mods` and `config`. For Prism Launcher this is usually `instances/<instance>/minecraft`. Use the launcher's folder-opening option to locate it.
5. Choose the translation language and click **Scan**. Select just one mod in the table, then click **Translate**. Header language changes the interface; the language beside **Translate** changes the game text.
6. In the confirmation dialog, choose Standard API for a small first check, or Batch for a larger workload when you can wait. Click **Start translation** to submit requests. Batch may take up to 24 hours. Wait for the progress/log dialog to finish. Confirm that it reports a completed translation, with no failed chunks. Keep the output path shown in the log.
7. Start Minecraft with that same instance. Open **Options → Resource Packs**, enable the generated pack under `resourcepacks`, and place it above packs that contain competing translations. Choose the matching game language.
8. Find an item or block from the selected mod. Seeing its translated name in game is the first success checkpoint. Only then increase the selection.

## Translate a pack's quests

Scan in **Quests**, select a target language and files, then click **Translate**. Review the workload, choose **Lower cost — Batch** or **Start right away — Standard API**, and confirm.

If you close the app while Batch is waiting, reopen the same tab and choose **Resume Batch results**. MML restores the original selection and settings and retrieves the saved provider job. Keep the source files unchanged. Once saved, follow the completion screen's instructions and check the same quest in Minecraft.

A connection loss immediately after submission can leave the submission outcome unknown. MML stops instead of automatically resubmitting; check the provider dashboard. Results may also expire at the provider. Standard API jobs cannot resume after restarting.

## Translate a guidebook

Complete the same API and game-folder setup as above. In **Guidebooks**, select the target language, scan, and choose a supported Patchouli book. Click **Translate**, choose the method, and start. Check the completion screen and output folder; the translation is added to the mod JAR with an original `.mml-original.bak` backup beside it. Updating the mod may remove it. Restart Minecraft in the target language, and open the same page. Check headings, text layout, and links as well as the translated body. Books using unsupported formats may not appear.

## Choose the right translation mode

| Content | Mode and result |
| --- | --- |
| Mod language files, including legacy `.lang` | **Mods** creates a resource pack. Enable it in the same game instance. |
| FTB Quests | **Quests** discovers supported layouts. Chapter SNBT may be changed in place; back up the instance first. Consolidated language SNBT writes the target language beside the source. |
| Patchouli books inside mod JARs | **Guidebooks**. Check both the output and the book in game. |
| A specific JSON/SNBT file outside discovery | **Custom Files** lets you choose files and an output directory. It prefixes output with the target language; the consuming mod may require a different filename/location. |

**Legacy and pack-specific placement:** BetterQuest `config/betterquesting/DefaultQuests.lang` is backed up as `.mml-original.bak` and translated in place so packs reading the fixed filename can load it. The Quests tab discovers Create: Astral's `resources/createastral/lang/en_us.json` and writes `ja_jp.json` beside it. Earlier instructions describing renamed outputs and manual copying applied to the old implementation. Multiplayer FTB Quests may require translations on the server that supplies the quests.

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| **Scan** is disabled | Select the game profile first. |
| No items after scanning | Check that you selected the folder containing `mods` and `config`, choose the correct tab, and clear the table filter. |
| **Translate** is disabled | Select a target language and at least one item; wait for any scan to finish. |
| API authentication or 401/403 error | Match the key to the provider, save settings, and check account/project permissions. Never include the key in an issue. |
| Model not found or 404 | Enter a model available to your account. Provider defaults and old saved models can be retired. See the key guide for model lists. |
| Quota, billing, or 429 error | Check provider usage/billing and rate limits; wait before trying a small selection again. |
| Context or output length error | Reduce the chunk size in Settings or enable token-based chunking. |
| JSON/translation response error | Keep the default JSON-oriented prompts, reduce the selection/chunk size, and inspect the error log. Do not treat partial output as complete. |
| Everything is skipped | Check **Skip when translations exist** and whether the selected target language is already present. |
| Export succeeded but game text is English | Check the output path, active instance, game language, and resource-pack priority. Quest/custom files may require their expected filename and location. |
| Interrupted translation | Inspect completed output and logs before retrying. Do not assume all modes resume from the interruption point. Restore the instance backup if needed. |
| Update check cannot find a manifest | Check your internet connection. If the problem persists, install manually from the v3 release page. Upgrading from v2 also requires manual installation. |

## Ask for help

Search [existing issues](https://github.com/Y-RyuZU/MinecraftModsLocalizer/issues) first. Include app version, OS/CPU, Minecraft and modpack versions, the selected tab, a relative source path, expected result, actual result, and the relevant error text. Remove API keys, account details, and private absolute paths. A minimal example you have permission to share helps reproduce file-format problems. Do not upload your `config.json`.
