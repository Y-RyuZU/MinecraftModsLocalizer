# Technical Context

## Technologies Used

### Frontend
- **Framework**: Next.js
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: React Context + zustand
- **Internationalization**: i18next + next-i18next

### Backend
- **Framework**: Tauri v2
- **Language**: Rust
- **File Operations**: Rust standard library and crates for file handling

## Development Setup

### Prerequisites
- Node.js and npm/bun for frontend development
- Rust and Cargo for backend development
- Tauri CLI for building and running the application

### Project Structure
```
MinecraftModsLocalizer/
├── src/                  # Next.js frontend code
│   ├── app/              # Next.js app router
│   └── lib/              # Shared utilities and types
├── src-tauri/            # Rust backend code
│   ├── src/              # Rust source files
│   └── Cargo.toml        # Rust dependencies
├── public/               # Static assets
└── package.json          # Node.js dependencies
```

### Build Process
1. Frontend assets are built using Next.js
2. Tauri bundles the frontend with the Rust backend
3. Platform-specific binaries are generated

## Technical Constraints

### LLM Token Limits
- LLMs have token limits that restrict the amount of text that can be processed at once
- Solution: Implement chunking to break large translation tasks into smaller pieces

### File Format Complexity
- Minecraft uses various file formats (JSON, SNBT) with specific structures
- Solution: Implement specialized parsers and processors for each format

### Performance Considerations
- JAR file operations can be resource-intensive
- Solution: Use Rust for file operations to maximize performance

### Security Considerations
- API keys for LLM services need to be stored securely
- Solution: Implement encrypted storage for sensitive information

### Tauri v2 API Changes
- Tauri v2 no longer exposes functionality through `window.__TAURI__`
- Solution: Use `window.__TAURI_INTERNALS__` or `window.isTauri` for accessing Tauri functionality
- Implementation: Created utility functions to safely detect and access Tauri v2 APIs with proper TypeScript typing
- Tauri v2 uses plugins for specific functionality like dialogs
- Solution: Use `@tauri-apps/plugin-dialog` for dialog functionality
- Implementation: Added dynamic import of the dialog plugin with proper error handling and fallback to the existing invoke method

## File Format Handling

### Lang Files (JSON)
Lang files are JSON files with a simple key-value structure:

```json
{
  "block.quarryplus.adv_pump": "Advanced Pump",
  "block.quarryplus.adv_quarry": "Chunk Destroyer",
  "block.quarryplus.book_mover": "Book Enchantment Mover"
}
```

**Processing Approach**:
1. Parse JSON file
2. Extract keys and values
3. Translate values
4. Generate new JSON file with original keys and translated values

### SNBT Files
SNBT (String NBT) is Minecraft's proprietary format, similar to JSON but with a slightly different structure:

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
      title: "Make andesite alloy"
      // ...
    }
  ]
}
```

**Processing Approach**:
1. Use regular expressions to extract translatable content (title, subtitle, description)
2. Translate the extracted content
3. Replace the original content with translated content

### JAR Files
JAR files are essentially ZIP archives containing compiled Java classes and resources:

**Processing Approach**:
1. Extract JAR contents to a temporary directory
2. Identify and process translatable files
3. Add translated files to the JAR
4. For resource packs, create new files in the appropriate directory structure

## Minecraft Version Compatibility

The tool is designed to work with modern Minecraft versions (1.16+) that use JSON-based language files. The file formats and structures are generally consistent across these versions, but there may be minor variations in specific mods.

## API Integration

The application integrates with various LLM APIs for translation:

1. **API Abstraction**: The Adapter pattern is used to abstract away the specifics of different LLM providers
2. **API Key Management**: API keys are stored securely and used for authentication
3. **Error Handling**: Robust error handling for API-related issues, including retry mechanisms
