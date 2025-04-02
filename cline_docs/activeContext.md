# Active Context

## Current Work
We have completed the implementation of the Minecraft Mods Localizer application according to the specifications in `/docs/spec.md`. The application now has the following features:

1. **UI Implementation**:
   - Main layout with tabs for Mods, Quests, Guidebooks, and Settings
   - Theme support (light/dark/system)
   - Responsive design using Tailwind CSS and shadcn/ui components

2. **Mod Translation**:
   - Scanning for mods in the specified directory
   - Analyzing mod JAR files to extract language files
   - Translating language files using LLM adapters
   - Creating resource packs with translated content

3. **Quest Translation**:
   - Support for FTB Quests and Better Quests
   - Scanning for quest files in the config directory
   - Translating quest content using LLM adapters
   - Saving translated quest files

4. **Guidebook Translation**:
   - Support for Patchouli guidebooks
   - Scanning for guidebooks in mod JAR files
   - Translating guidebook content using LLM adapters
   - Writing translated content back to JAR files

5. **Settings Management**:
   - LLM provider configuration (OpenAI, Anthropic, Google)
   - Translation settings (source/target languages, chunk sizes)
   - Path settings for Minecraft directories
   - UI preferences

6. **State Management**:
   - Global state using Zustand
   - Configuration persistence
   - Translation progress tracking
   - Error handling

## Recent Changes
- Implemented UI components for all tabs (Mods, Quests, Guidebooks, Settings)
- Completed Rust backend functions for file operations
- Integrated LLM adapters for translation
- Added state management with Zustand
- Implemented file service for handling Minecraft files
- Added configuration management
- Fixed Tauri API integration issues by using mock functions for development
- Successfully tested all UI components and functionality
- Fixed duplicate key issues in component rendering
- Fixed theme hydration mismatch issues
- Fixed CORS issues with fonts
- Improved UI layout with centered content and proper margins
- Enhanced Settings tab with language selection dropdown
- Added support for custom language addition
- Refactored Settings tab into modular components for better maintainability
- Added default model selection based on LLM provider
- Set OpenAI default model to gpt-4o-mini-2024-07-18
- Enhanced UI with Card components for better visual grouping of settings
- Fixed Tauri v2 API import in config-service.ts (replaced direct import with window.__TAURI__?.invoke)
- Made translation targets independent for each tab (mods, quests, guidebooks, custom files)
- Updated property names to use snake_case consistently (prompt_template, mod_chunk_size, etc.)
- Enhanced translation service integration with proper error handling
- Added custom prompt template field in LLM settings
- Implemented internationalization with i18next for multi-language UI support
- Fixed hydration mismatch in LanguageSwitcher component by implementing client-side only rendering approach
- Fixed inconsistency in property naming between Rust backend and TypeScript frontend:
  - Updated all TypeScript interfaces (config.ts, llm.ts) to use snake_case consistently
  - Updated all components (LLMSettings, TranslationSettings, PathSettings) to use the snake_case property names
  - Updated LLM adapters (OpenAIAdapter, BaseLLMAdapter, LLMAdapterFactory) to use the snake_case property names
  - Updated translation service to use the snake_case property names
- Fixed native dialog integration in Tauri v2:
  - Updated file-service.ts to properly handle server-side rendering (SSR)
  - Improved Tauri environment detection for Tauri v2
  - Fixed dynamic import of Tauri API invoke function
  - Updated mock implementation to match Rust backend behavior
- Fixed Tauri API import in file-service.ts:
  - Replaced dynamic import of '@tauri-apps/api/tauri' with direct access to window.__TAURI__?.invoke
  - Simplified Tauri environment detection
  - Improved error handling for Tauri API calls

## Next Steps
1. **Testing and Debugging**:
   - Test all translation workflows with real Minecraft mods
   - Fix any bugs or issues found during testing
   - Improve error handling

2. **Performance Optimization**:
   - Optimize translation process for large mods
   - Improve file scanning performance
   - Add caching for translated content

3. **Packaging and Distribution**:
   - Create installers for Windows, macOS, and Linux
   - Add auto-update functionality
   - Create documentation for users

4. **Additional Features**:
   - Add support for more Minecraft mod formats
   - Improve translation quality with context-aware prompts
   - Add batch translation functionality
