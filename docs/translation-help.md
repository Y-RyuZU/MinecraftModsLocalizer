# Translation details and troubleshooting

[Back to the quick start](getting-started.md)

## Translate a pack's quests

Scan in **Quests**, select a target language and files, then click **Translate**. Review the workload, choose **Lower cost — Batch** or **Start right away — Standard API**, and confirm.

If you close the app while Batch is waiting, reopen the same tab and choose **Resume Batch results**. MML restores the original selection and settings and retrieves the saved provider job. Keep the source files unchanged. Once saved, follow the completion screen's instructions and check the same quest in Minecraft.

A connection loss immediately after submission can leave the submission outcome unknown. MML stops instead of automatically resubmitting; check the provider dashboard. Results may also expire at the provider. Standard API jobs cannot resume after restarting.

## Translate a guidebook

Set up your API and game folder using the [quick start](getting-started.md). In **Guidebooks**, select the target language, scan, and choose a supported Patchouli book. Click **Translate**, choose the method, and start. Check the completion screen and output folder; the translation is added to the mod JAR with an original `.mml-original.bak` backup beside it. Updating the mod may remove it. Restart Minecraft in the target language, and open the same page. Check headings, text layout, and links as well as the translated body. Books using unsupported formats may not appear.

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
