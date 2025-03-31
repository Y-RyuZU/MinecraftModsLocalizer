# Product Context

## Why This Project Exists
The MinecraftModsLocalizer project exists to solve a common problem faced by Minecraft Mod players: the language barrier. Many Minecraft mods are only available in English, making it difficult for non-English speaking players to fully enjoy and understand the content. This tool automates the translation process for various Minecraft mod components, making mods more accessible to a global audience.

## What Problems It Solves
1. **Language Accessibility**: Enables non-English speaking players to enjoy mods in their native language
2. **Manual Translation Burden**: Eliminates the need for manual translation of large mod files
3. **Format Complexity**: Handles the complexity of various Minecraft file formats (lang, JSON, SNBT)
4. **Consistency**: Ensures consistent translations across different mod components
5. **Time Efficiency**: Significantly reduces the time needed to translate mod content

## How It Should Work
The application works by:
1. Detecting mod files in the Minecraft mods directory
2. Analyzing the files to identify translatable content
3. Chunking the content to manage token limits
4. Sending the content to LLM services for translation
5. Processing the translated content
6. Outputting the translations in the appropriate format and location

The tool supports three main translation workflows:
1. **Mod Lang Files**: Translates language files and outputs as resource packs
2. **Quest Files**: Translates FTB Quests and Better Quests, creating JSON files or modifying SNBT files
3. **Patchouli Guidebooks**: Translates guidebook content and injects it back into JAR files

## Target Users
The primary users are Minecraft Mod players who:
- Prefer to play Minecraft in languages other than English
- Use modpacks with multiple mods
- Want to understand quest descriptions, item names, and guidebook content in their native language
- May not have the time or language skills to manually translate mod content

## Translation Workflows Supported

### 1. Mod Lang File Translation
- **Input**: Detects `.jar` files in Minecraft's mods directory
- **Process**: Extracts and analyzes language files, translates content
- **Output**: Creates resource packs in the target language at `resourcepacks/{target language}`

### 2. Quest File Translation
- **FTB Quests**:
  - **Input**: Either `kubejs/assets/kubejs/lang/en_us.json` or `config/ftbquests/quests/chapters/**.snbt`
  - **Process**: Translates quest titles, subtitles, and descriptions
  - **Output**: Either creates language JSON files or modifies SNBT files directly

- **Better Quests**:
  - **Input**: `recourses/betterquesting/lang/en_us.json`
  - **Process**: Translates quest content
  - **Output**: Creates `{language name}.json` in the same directory

### 3. Patchouli Guidebook Translation
- **Input**: Patchouli book files in mod JAR files
- **Process**: Temporarily extracts JAR contents, identifies and translates guidebook content
- **Output**: Modifies the original JAR file to include translated guidebook content
