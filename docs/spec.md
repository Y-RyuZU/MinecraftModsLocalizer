# Minecraft Mod & Quest Translation Tool Specification

## 1. Project Overview

### 1.1 Purpose

The purpose is to develop a desktop application that automates the translation of Minecraft Mods and Quests.

### 1.2 Target Users

Minecraft Mod players

### 1.3 Key Features Overview

- Mod lang file translation -> Output translation results as resource packs
- Quest file (FTB Quests, Better Quests) translation -> Create JSON in specific directories or overwrite content in specific SNBT files
- Patchouli guidebook translation -> Output JSON into specific existing JAR files

## 2. Technology Stack

### 2.1 Frontend

- **Framework**: Next.js
- **Language**: TypeScript
- **UI Library**: shadcn/ui + Tailwind CSS
- **State Management**: React Context + zustand

### 2.2 Backend

- **Framework**: Tauri
- **Language**: Rust

## 3. Functional Requirements

### 3.1 UI/UX Requirements

- **Theme**: Light/Dark mode switchable
- **Responsive Design**: Grid layout in desktop app, somewhat resizable
- **Navigation Structure**:
    - Main Screen: Translation target type selection (Mod, FTBQuests, BetterQuest, Patchouli) → Translation button
    - Only when Mod is selected, a translation target selection table is displayed
    - Settings Screen: API key input, prompt editing, chunk size, target language, resource pack name configuration

### 3.2 Progress Display and Interruption Feature

- **Progress Bar**:
    - Visual display of translation progress
    - Text display in the format "X / Y items completed (Z%)"
    - During processing, information about current sub-list and chunks is also displayed
- **Interruption Feature**:
    - "Interrupt" button available at any time during translation
    - When interrupted, safely stops after completing the current sub-list processing
    - Option to save partially completed translation results
- **Error Display**:
    - Error content displayed in a dedicated error component when errors occur
    - Retry button provided to reprocess only the relevant chunk
- **Completion Notification**:
    - System notification and completion summary displayed upon translation completion

### 3.2 Data Processing

- **Data Storage Method**: Local storage
- **File Operations**: Mod file loading, resource pack generation
- **Data Formats**: lang, json, snbt

## 4. Non-functional Requirements

### 4.1 Error Handling

- Keep logs for all processes, leave log files in the logs directory for both success and failure
- Error logs must always record the date and time

## 5. Architecture Design

### 5.1 Overall Architecture

- Adopt the Adapter pattern to flexibly switch between LLMs
- Properly divide functions and classes based on the principle of one class, one responsibility

### 5.3 Error Handling

- **Retry Strategy**:
    
    - In case of error, attempt to retry immediately up to 5 times
    - If still failing after 5 retries, skip that chunk and proceed to the next
- **Error Type-Specific Handling**:
    
    ```typescript
    // Error handling example
    async function handleTranslationError(error: Error, chunk: TranslationChunk): Promise<void> {
      // Log error content
      logger.error(`Translation error: ${error.message}`, {
        chunkId: chunk.id,
        errorType: error.name,
        stackTrace: error.stack
      });
      
      // Display error in UI
      displayError({
        title: 'Translation Error',
        message: `Error processing chunk ${chunk.id}: ${error.message}`,
        details: error.stack
      });
      
      // Specific processing based on error type
      if (error.name === 'ApiKeyInvalidError') {
        notifyUser('API Key is invalid. Please check your settings.');
      } else if (error.name === 'TokenLimitExceededError') {
        // Suggest automatic adjustment of chunk size
        suggestSmallerChunkSize();
      }
    }
    ```
    
- **Partial Success Processing**:
    
    - Process successful translations and failed translations separately
    - Output successful parts as normal
    - Display failed parts as a list in the UI, enabling manual translation by the user
    - Logs are always displayed in real-time streaming

## 6. UI Design

### 6.1 Component Design

- **Main Screen**
    
    - Translation execution screen (translation target selection table is placed)
    - Settings screen (API key input, prompt editing, chunk size, target language, resource pack name)
    - Batch translation screen for SNBT or JSON files (execute translation processing for all SNBT files under the specified directory)
- **Header**
    
    - Light/Dark mode toggle button
    - Settings gear icon
    - Tool language setting (default is English)
- **Components**
    
    - Translation target selection table
        - Table elements
            - Checkbox (default is all ON)
            - Mod name (multiple) or Quest (single) or Patchouli
        - Sort button (toggle between checkbox status and alphabetical order)
        - Mod name/Quest name search bar

## 7. Detailed Specifications

### 7.1 File Detection and Processing

#### 7.1.1 Detection of Translation Target Files

- Detect all `.jar` files in Minecraft's mods directory
- Each `.jar` file is recognized as a Mod
- `.jar` files are unzipped and processed as zip
- File processing is performed in alphabetical order

#### 7.1.2 File Analysis Method

```typescript
// Sample function for JAR file analysis
async function analyzeJarFile(jarPath: string): Promise<ModInfo> {
  // Process as unzipped ZIP
  const entries = await extractZipEntries(jarPath);
  
  // Search for language files
  const langFiles = entries.filter(entry => 
    entry.path.includes('/lang/') && entry.path.endsWith('.json')
  );
  
  // Search for Patchouli books
  const patchouliBooks = entries.filter(entry =>
    entry.path.includes('/patchouli_books/')
  );
  
  return {
    modId: extractModId(entries),
    langFiles,
    patchouliBooks
  };
}
```

Minecraft profiles have the following structure

```
Configuration Files/
│
├── minecraft-mods-localizer-windows.exe
├── config/
├── kubejs/
├── resourcepacks/
├── mods/
└── logs/
    └── localizer/
        └── {date}/
├── resourcepacks/
```

- This tool can be executed by placing it in this profile
- This tool recognizes mod groups from the mods directory at the same level
- Creates `logs/localizer/{date}` directory during execution

### 7.2 Translation Processing

#### 7.2.0 Translation Process Flow

**Chunking:**

- Since the translation target is a huge amount, translating everything at once would hit the LLM token limit
- Divide the main list of translation targets into sub-lists according to the chunk size specified in settings
    - Chunk size range: 1-1000
    - Default value for Mods: 50
    - Default value for FTBQuests, BetterQuest, Patchouli: 1
- Sequentially pass the divided sub-lists to the LLM call function
- After all translations are completed, combine the sub-lists to create a large list, and perform various file operations

**LLM Processing:**

- LLMs can be flexibly switched via the Adapter pattern
- The Adapter interface has a `translate` function (argument: list in key: value format, return: key: value format)
    - The value is translated from English to the specified language
- If the list length differs before and after translation processing, it is treated as an error
- Errors are tolerated up to 5 times, and if translation still fails, the chunk is skipped

**System Variables:**

- Constants that might be hardcoded, such as default LLM prompts, timeout periods, error limits, are grouped into one class
- Include default settings for supported languages:
    
    ```typescript
    // Supported languages (display name and language ID)
    const DEFAULT_LANGUAGES = [
      { name: "日本語", id: "ja_jp" },
      { name: "中文", id: "zh_cn" },
      { name: "Korean", id: "ko_kr" },
      { name: "German", id: "de_de" },
      { name: "French", id: "fr_fr" },
      { name: "Spanish", id: "es_es" }
    ];
    ```
    
- Users can add custom languages (save display name and language ID as pairs)

**Default Prompt:**

```
PROMPT = """You are a professional translator. Please translate the following English text into {language}. 

## Important Translation Rules
- Translate line by line, strictly in order
- Ensure the number of lines before and after translation matches exactly (do not add or remove lines)
- Output only the translation result, without any greetings or explanations

## Input Text Information
- Number of lines: {line_count}

## Detailed Translation Instructions
- Treat sentences on different lines as separate, even if they seem contextually connected
- If multiple sentences appear on a single line, translate them as one line
- Use appropriate phonetic transcription for proper nouns when needed
- Preserve programming variables (e.g., %s, $1, \") and special symbols as they are
- Maintain backslashes (\\) as they may be used as escape characters
- Do not edit any characters that appear to be special symbols
- For idiomatic expressions, prioritize conveying the meaning over literal translation.
- When appropriate, adapt cultural references to be more relevant to the target language audience.
- The text is about Minecraft mods. Keep this context in mind while translating

Once you receive the input text, proceed with the translation following these rules strictly.

# Example
### input
§6Checks for ore behind the §6walls, floors or ceilings.
Whether or not mining fatigue is applied to players in the temple if it has not yet been cleared.

### incorrect output
§6壁、床、または天井の後ろにある鉱石をチェックします。
まだクリアされていない場合、寺院内のプレイヤーにマイニング疲労が適用されるかどうか。

### correct output
§6後ろにある鉱石をチェックします。
§6壁、床、または天井
寺院内のプレイヤーにマイニング疲労が適用されるかどうか。
もしクリアされていない場合

### input
Add a new requirement group.Requirement groups can hold multiplerequirements and basicallymake them one big requirement.Requirement groups have two modes.In §zAND §rmode, all requirements needto return TRUE (which means "Yes, load!"),but in §zOR §rmode, only one requirementneeds to return TRUE.

### incorrect output
新しい要件グループを追加します。
要件グループは複数の要件を保持でき、基本的にそれらを1つの大きな要件にまとめます。要件グループには2つのモードがあります。
§zAND §rモードでは、すべての要件がTRUE（「はい、ロードする！」を意味します）を返す必要がありますが、§zOR §rモードでは、1つの要件だけがTRUEを返す必要があります。

### correct output
新しい要件グループを追加します。要件グループは複数の要件を保持し、基本的にそれらを1つの大きな要件にまとめます。要件グループには2つのモードがあります。§zAND §rモードでは、すべての要件がTRUE（「はい、読み込みます！」という意味）を返す必要がありますが、§zOR §rモードでは、1つの要件だけがTRUEを返せば十分です。"""
```

#### 7.2.1 JSON Files

**Specifications:**

- Simple key: value array structure. The key is a unique text key, and the value contains content to actually display
- Create various {language id}.json based on en_us.json
- If {language id}.json already exists, translate untranslated parts in {language id}.json to the specified language referring to the same key's value in en_us.json

**Sample:**

```json
{
  "FD.UNKNOWN": "UNKNOWN Direction",
  "FD.down": "DOWN",
  "FD.east": "EAST",
  "FD.north": "NORTH",
  "FD.south": "SOUTH",
  "FD.up": "UP",
  "FD.west": "WEST",
  "_comment": "English lang file.",
  "block.quarryplus.InfMJSrc": "InfinityMJSource",
  "block.quarryplus.adv_pump": "Advanced Pump",
  "block.quarryplus.adv_quarry": "Chunk Destroyer",
  "block.quarryplus.book_mover": "Book Enchantment Mover"
  // Omitted
}
```

#### 7.2.2 SNBT Files

**Specifications:**

- Very similar to JSON, but with a slightly different structure, Minecraft's proprietary file format
- Directly rewrite the contents of the SNBT file to be translated
- Translate title, subtitle, description items using regular expressions

**Implementation Reference Code:**

```python
# Extract description strings
description_pattern = r'description: \[\s*([\s\S]*?)\s*\]'
description_matches = re.findall(description_pattern, content)
for match in description_matches:
    for inner_match in re.findall(r'(?<!\\)"(.*?)(?<!\\)"', match):
        if inner_match:  # Non-empty strings
            extracted_strings.append(inner_match)

# Extract title and subtitle strings
title_and_subtitle_pattern = r'(title|subtitle): "(.*?)"'
title_and_subtitle_matches = re.findall(title_and_subtitle_pattern, content)
for _, inner_match in title_and_subtitle_matches:
    if inner_match:  # Non-empty strings
        extracted_strings.append(inner_match)
```

**Sample:**

```
{
	default_hide_dependency_lines: false
	default_quest_shape: ""
	filename: "create"
	group: "315C3F3029478ED7"
	icon: "create:wrench"
	id: "0D893DF99279E3BD"
	order_index: 0
	quest_links: [ ]
	quests: [
		{
			dependencies: ["03C063D04037EEA7"]
			description: ["To make andesite alloy you will need &l&62 andesite&r&r and &l&62 iron or zinc nuggets&r&r"]
			id: "2771124207DF211A"
			progression_mode: "flexible"
			rewards: [
				{
					count: 10
					id: "2FEC9E44856D5A04"
					item: "create:andesite_alloy"
					type: "item"
				}
				{
					count: 5
					id: "24BD454E294E99F1"
					item: "create:experience_nugget"
					type: "item"
				}
			]
			subtitle: "Make andesite alloy"
			tasks: [{
				id: "385786D17BCC5296"
				item: "create:andesite_alloy"
				only_from_crafting: false
				type: "item"
			}]
			title: "Make andesite alloy"
			x: 1.5d
			y: 0.0d
		}
	]
}
```

### 7.3 Output Results

#### 7.3.1 Mod Translation

- Output as resource pack to `resourcepacks/{target language}`

#### 7.3.2 Quest Translation

**For FTB Quest:**

- Check if `kubejs/assets/kubejs/lang/en_us.json` exists
    - When it exists:
        - Output translation results to `kubejs/assets/kubejs/lang/{target language}.json`
        - Output translation results to `kubejs/assets/ftbquests/lang/{target language}.json`
    - When it doesn't exist:
        - Translate `config/ftbquests/quests/chapters/**.snbt`

**For BetterQuests:**

- Create new `{language name}.json` based on the contents of `recourses/betterquesting/lang/en_us.json`

#### 7.3.3 Patchouli Translation

- Temporarily unzip all Mod jar files to `logs/localizer/{date}/tmp` directory
- Check if the unzipped contents include `{mod.jar}/assets/{mod_name}/patchouli_books/{guide_name}/en_us.json`
    - When included:
        - Edit the original mod Jar file and add the file `{mod.jar}/assets/{mod_name}/patchouli_books/{guide_name}/{language id}.json`

**Reference Function for Getting mod_name:**

```python
def get_mod_name_from_jar(jar_path):
    with zipfile.ZipFile(jar_path, 'r') as zip_ref:
        asset_dirs_with_lang = set()
        for name in zip_ref.namelist():
            parts = name.split('/')
            if len(parts) > 3 and parts[0] == 'assets' and parts[2] == 'lang' and parts[1] != 'minecraft':
                asset_dirs_with_lang.add(parts[1])
        if asset_dirs_with_lang:
            return list(asset_dirs_with_lang)[0]
    return None
```

### 7.9 Output Results

#### 7.9.1 Output Format

- **Mod Translation**: Output as resource pack to `resourcepacks/{target language}`
- **FTBQuests Translation**: Output as SNBT or JSON file matching the original directory structure
- **BetterQuests Translation**: Output as JSON file matching the original directory structure
- **Patchouli Translation**: Output as JSON file matching the original directory structure

#### 7.9.2 Detailed Processing for Each Type

**For Mod Translation:**

- Detect `/assets/{mod_id}/lang/en_us.json` in `.jar` file
- After translation, output to `resourcepacks/{target language}/assets/{mod_id}/lang/{target language}.json`

**For FTB Quests:**

- Check if `kubejs/assets/kubejs/lang/en_us.json` exists
    - When it exists:
        - Output translation results to `kubejs/assets/kubejs/lang/{target language}.json`
        - Output translation results to `kubejs/assets/ftbquests/lang/{target language}.json`
    - When it doesn't exist:
        - Translate `config/ftbquests/quests/chapters/**.snbt` and overwrite in the same location

**For BetterQuests:**

- Create `{target language}.json` in the same directory based on the contents of `recourses/betterquesting/lang/en_us.json`

**For Patchouli Translation:**

- Temporarily unzip all Mod jar files to `logs/localizer/{date}/tmp` directory
- Check if the unzipped contents include `{mod.jar}/assets/{mod_name}/patchouli_books/{guide_name}/en_us.json`
    - When included:
        - Edit the original mod Jar file and add the file `{mod.jar}/assets/{mod_name}/patchouli_books/{guide_name}/{language id}.json`
- If multiple Patchouli guidebooks exist, all are targets for translation

**Reference Function for Getting mod_name:**

```typescript
function getModNameFromJar(jarPath: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const zip = new JSZip();
    
    fs.readFile(jarPath)
      .then(data => zip.loadAsync(data))
      .then(contents => {
        const assetDirsWithLang = new Set<string>();
        
        Object.keys(contents.files).forEach(filename => {
          const parts = filename.split('/');
          if (parts.length > 3 && parts[0] === 'assets' && parts[2] === 'lang' && parts[1] !== 'minecraft') {
            assetDirsWithLang.add(parts[1]);
          }
        });
        
        if (assetDirsWithLang.size > 0) {
          resolve(Array.from(assetDirsWithLang)[0]);
        } else {
          resolve(null);
        }
      })
      .catch(err => reject(err));
  });
}
```

## 9. Distribution and Deployment

### 9.1 Packaging

- Generate native binaries for each OS using Tauri
    - Windows: `.exe`
    - macOS: `.app`
    - Linux: `.AppImage`

### 9.2 Distribution Method

- GitHub Releases
- Direct distribution of binary files

### 9.3 Update Notification

- Check for new versions via GitHub API
- Automatically run update check at app startup
- Display warning dialog if a new version is available

```typescript
// Version management constants
const VERSION = 'v2.1.3'; // Manually update when changed
const USER = 'Y-RyuZU'; // GitHub username
const REPO = 'MinecraftModsLocalizer'; // Repository name

// Function to check the latest release on GitHub
async function getLatestReleaseTag(): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${USER}/${REPO}/releases/latest`;
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      return data.tag_name;
    } else {
      logger.error(`Error ${response.status}: ${await response.text()}`);
      return null;
    }
  } catch (error) {
    logger.error('Failed to check for updates:', error);
    return null;
  }
}

// Compare current version with latest version
async function checkVersion(): Promise<boolean> {
  const latestTag = await getLatestReleaseTag();
  if (latestTag) {
    if (VERSION === latestTag) {
      return true; // Latest version
    } else {
      // Display warning when versions differ
      showUpdateWarning(VERSION, latestTag);
      return false;
    }
  }
  return true; // Consider current version as latest if unable to check
}

// Display warning at startup
function showUpdateWarning(currentVersion: string, latestVersion: string): void {
  const message = `Current version (${currentVersion}) is not the latest.\nLatest version (${latestVersion}) is available.\nWe recommend downloading from GitHub.`;
  
  dialog.showMessageBox({
    type: 'warning',
    title: 'Update Notification',
    message,
    buttons: ['Later', 'Open GitHub'],
    defaultId: 1
  }).then(result => {
    if (result.response === 1) {
      // Open GitHub releases page
      open(`https://github.com/${USER}/${REPO}/releases/latest`);
    }
  });
}

// Automatically check for updates when application starts
app.whenReady().then(async () => {
  // Other initialization processing
  
  // Version check (run asynchronously to avoid UI blocking)
  setTimeout(async () => {
    await checkVersion();
  }, 3000); // Check 3 seconds after startup
});
```