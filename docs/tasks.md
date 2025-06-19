# MinecraftModsLocalizer Development Plan

## Current Tasks

- [✅] **TASK_008: Fix Progress Calculation and History Dialog UI Issues** - [Details](TASK_008_Fix_Progress_Calculation_And_History_Dialog_Issues.md) (Completed - 2025-06-18 01:33:18)
    - Fix incorrect progress denominator causing 100% completion while translation continues
    - Fix history dialog close button positioning and overflow issues

- [✅] **TASK_009: Fix Mod Progress Calculation and Add Alphabetical Sorting** - [Details](TASK_009_Fix_Mod_Progress_Calculation_And_Add_Alphabetical_Sorting.md) (Completed - 2025-06-18 01:43:36)
    - Fix remaining mod translation progress calculation issues
    - Add alphabetical sorting by mod name for translation processing

- [✅] **TASK_010: Fix Tauri Errors and Implement Mod-Level Progress** - [Details](TASK_010_Fix_Tauri_Errors_And_Mod_Level_Progress.md) (Completed - 2025-06-18 01:56:21)
    - Fix Tauri command errors for JSON parsing and UTF-8 encoding issues
    - Implement mod-level progress tracking instead of chunk-level

- [✅] **TASK_011: Fix History Dialog and Enhance Completion Dialog** - [Details](TASK_011_Fix_History_Dialog_And_Enhance_Completion_Dialog.md) (Completed - 2025-06-18 02:14:44)
    - Fix close button overflow in history dialog
    - Display successful vs failed translation counts in completion dialog

- [ ] **TASK_012: Improve Target Language Selector UI and Consolidate Language Selection** - [Details](TASK_012_Improve_Target_Language_Selector_UI_And_Consolidate_Language_Selection.md) (Active - 2025-06-18 04:00:32)
    - Fix vertical alignment of target language selector
    - Remove unnecessary description text
    - Add context to error messages
    - Remove "Temporary" prefix and consolidate language selection

- [ ] **TASK_013: Install And Implement Storybook** - [Details](TASK_013_Install_And_Implement_Storybook.md) (Active - 2025-06-19 12:53:41)
    - Install Storybook 8.x with Next.js 15 and React 19 compatibility
    - Configure for existing TypeScript and Tailwind CSS setup
    - Create stories for UI components
    - Set up theme and i18n integration

## Highest Priority Tasks (Architecture and Foundation Design)

- [ ] **Project Initialization and Basic Structure**
    
    - [ ] Set up Tauri + Next.js project
    - [ ] Define directory structure
    - [ ] Create basic configuration files
- [ ] **Core Architecture Design**
    
    - [ ] Design LLM adapter interface
    - [ ] Design implementation classes for each LLM API
    - [ ] Design overall system dependencies
- [ ] **Data Model Design**
    
    - [ ] Define configuration data model
    - [ ] Define translation data model
    - [ ] Design application state management (zustand)
- [ ] **File Operation Core Feature Design**
    
    - [ ] Design jar file analysis module
    - [ ] Design file reading/writing utilities
    - [ ] Design resource pack generation functionality

## High Priority Tasks (Main Feature Implementation)

- [ ] **LLM Translation Feature Implementation**
    
    - [ ] Implement translation chunk processing module
    - [ ] Implement various LLM adapters
    - [ ] Implement prompt template functionality
- [ ] **Minecraft-related File Analysis Implementation**
    
    - [ ] Implement jar file analysis
    - [ ] Implement lang/json/snbt file analysis
    - [ ] Implement special file format processing
- [ ] **UI Component Foundation Implementation**
    
    - [ ] Implement base layout
    - [ ] Implement navigation structure
    - [ ] Implement theme (light/dark) switching
- [ ] **Settings and Storage Feature Implementation**
    
    - [ ] Implement settings save and load functionality
    - [ ] Implement API key encrypted storage functionality
    - [ ] Implement logging system

## Medium Priority Tasks (UI Implementation)

- [ ] **Main Screen UI Implementation**
    
    - [ ] Implement translation type selection UI
    - [ ] Implement Mod list table
    - [ ] Implement translation execution/interruption controls
- [ ] **Settings Screen UI Implementation**
    
    - [ ] Implement API key settings UI
    - [ ] Implement language selection UI
    - [ ] Implement advanced settings UI
- [ ] **Log and Progress Display UI Implementation**
    
    - [ ] Implement log display component
    - [ ] Implement progress bar
    - [ ] Implement error display component
- [ ] **Other Auxiliary Screen Implementation**
    
    - [ ] Implement snbt file batch translation screen
    - [ ] Implement failed translation display/editing screen

## Low Priority Tasks (Advanced Features & Finishing Touches)

- [ ] **Error Handling Implementation**
    
    - [ ] Implement error retry functionality
    - [ ] Implement error type-specific responses
    - [ ] Implement validation functionality
- [ ] **Packaging and Distribution Setup**
    
    - [ ] Configure builds for various OS
    - [ ] Implement version management functionality
    - [ ] Implement GitHub update check functionality
- [ ] **Optimization and Performance Improvement**
    
    - [ ] Optimize large data processing
    - [ ] Improve UI responsiveness
    - [ ] Optimize memory usage
- [ ] **Documentation and Testing**
    
    - [ ] Create user manual
    - [ ] Create and run test cases
    - [ ] Create code documentation

## Very Low Priority Tasks (Additional Features)

- [ ] **Multilingual UI Support**
    
    - [ ] Implement multilingual support for the tool itself
    - [ ] Create language resource files
- [ ] **Processing Speed Improvement Features**
    
    - [ ] Consider implementing parallel processing
    - [ ] Consider caching functionality
- [ ] **UX Improvements**
    
    - [ ] Implement first-launch guide
    - [ ] Add tooltips and detailed explanations
- [ ] **Additional Features**
    
    - [ ] Consider external terminology dictionary reference functionality
    - [ ] Consider past translation history display functionality