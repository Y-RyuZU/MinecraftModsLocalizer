# System Patterns

## How the System is Built
The MinecraftModsLocalizer is built as a desktop application using Tauri, which combines a Rust backend with a Next.js frontend. This architecture provides the performance benefits of Rust for file operations and system-level tasks, while leveraging the rich UI capabilities of Next.js for the user interface.

## Key Technical Decisions

1. **Tauri Framework**: Chosen for its ability to create lightweight, secure, and performant desktop applications with web technologies.

2. **Adapter Pattern for LLMs**: The system uses the Adapter pattern to abstract away the specifics of different LLM providers, allowing for flexible switching between different translation services.

3. **Chunking Strategy**: To handle token limits of LLMs, the system divides large translation tasks into manageable chunks, processes them separately, and then combines the results.

4. **Single Responsibility Principle**: Each class and function has a single, well-defined responsibility, making the system more maintainable and testable.

5. **Error Handling Strategy**: The system implements a robust error handling approach with retry mechanisms, error-specific responses, and partial success processing.

## Architecture Patterns

### Overall Architecture
The application follows a layered architecture:

1. **Presentation Layer**: Next.js frontend with shadcn/ui components and Tailwind CSS
2. **Application Layer**: Business logic for translation processing, file operations, and state management
3. **Infrastructure Layer**: Tauri/Rust backend for system-level operations and file handling

### Design Patterns Used

1. **Adapter Pattern**: Used for LLM service integration, allowing the system to switch between different LLM providers without changing the core translation logic.

2. **Factory Pattern**: Used for creating appropriate file processors based on file types.

3. **Strategy Pattern**: Used for implementing different translation strategies based on the type of content (Mod, FTB Quests, Better Quests, Patchouli).

4. **Observer Pattern**: Used for progress tracking and notification.

5. **Repository Pattern**: Used for data access and persistence.

## Frontend-Backend Communication Patterns

The communication between the Next.js frontend and the Rust backend is handled through Tauri's command API:

1. **Command Registration**: Rust functions are exposed to the frontend through Tauri commands.

2. **Asynchronous Communication**: Commands are executed asynchronously, with promises on the frontend side.

3. **Event-Based Updates**: For long-running operations, the backend emits events that the frontend listens to for progress updates.

4. **Error Propagation**: Errors from the backend are properly propagated to the frontend for display and handling.

5. **Server-Side Rendering (SSR) Handling**: Since Next.js uses SSR, we implement special handling to ensure Tauri commands work properly in both SSR and client-side contexts.

6. **Tauri v2 API Integration**: We use dynamic imports and environment detection to properly integrate with Tauri v2 API.

Example of frontend-backend communication:

```typescript
// Frontend (Next.js)
// Using the FileService for Tauri commands
import { FileService } from '@/lib/services/file-service';

// Invoke a command
async function translateMod(modId: string, targetLanguage: string) {
  try {
    const result = await FileService.invoke('translate_mod', { modId, targetLanguage });
    return result;
  } catch (error) {
    console.error('Translation failed:', error);
    throw error;
  }
}
```

```rust
// Backend (Rust)
#[tauri::command]
async fn translate_mod(mod_id: String, target_language: String) -> Result<TranslationResult, String> {
    // Implementation
    Ok(translation_result)
}
```

### Tauri v2 Integration Strategy

To properly integrate with Tauri v2 in a Next.js application, we implement the following strategy:

1. **SSR Detection**: We detect if the code is running in a server-side rendering context and provide appropriate fallbacks.

```typescript
// Flag to indicate if we're in a server-side rendering environment
const isSSR = typeof window === 'undefined';
```

2. **Dynamic API Import**: We dynamically import the Tauri API to avoid issues during SSR.

```typescript
// Only try to import Tauri API in client-side code
if (!isSSR) {
  try {
    // Use a dynamic import with a specific path
    import('@tauri-apps/api/tauri').then(({ invoke }) => {
      if (typeof invoke === 'function') {
        tauriInvokeFunction = invoke;
        console.log('Successfully loaded Tauri invoke function');
      }
    });
  } catch (error) {
    console.error('Error setting up Tauri API:', error);
  }
}
```

3. **Tauri Environment Detection**: We detect if the application is running in a Tauri environment.

```typescript
const isTauriEnvironment = (): boolean => {
  // Always return false in SSR
  if (isSSR) {
    return false;
  }
  
  try {
    // In Tauri v2, we can check for these properties
    const hasTauriInternals = typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined';
    const hasIsTauri = typeof (window as unknown as Record<string, unknown>).isTauri !== 'undefined';
    const hasTauriClass = document.documentElement.classList.contains('tauri');
    
    return hasTauriInternals || hasIsTauri || hasTauriClass;
  } catch (error) {
    console.error('Error checking Tauri environment:', error);
    return false;
  }
};
```

4. **Mock Implementation**: We provide mock implementations for development and SSR contexts.

```typescript
// In SSR, always use mock
if (isSSR) {
  console.log(`[SSR] Using mock for command: ${command}`);
  return mockInvoke<T>(command, args);
}

const isTauri = isTauriEnvironment();
if (isTauri && tauriInvokeFunction) {
  // Use the Tauri API
  return await tauriInvokeFunction<T>(command, args);
} else {
  // Use mock implementation
  return mockInvoke<T>(command, args);
}
```

## File Processing Workflows

### 1. Mod Lang File Translation Workflow

1. **Detection**: Scan the Minecraft mods directory for `.jar` files
2. **Extraction**: Extract language files from the JAR files
3. **Analysis**: Identify translatable content
4. **Chunking**: Divide content into manageable chunks
5. **Translation**: Send chunks to LLM for translation
6. **Combination**: Combine translated chunks
7. **Output**: Generate resource pack with translated content

### 2. Quest File Translation Workflow

1. **Detection**: Identify the type of quest system (FTB Quests or Better Quests)
2. **Extraction**: Extract translatable content from quest files
3. **Chunking**: Divide content into manageable chunks
4. **Translation**: Send chunks to LLM for translation
5. **Combination**: Combine translated chunks
6. **Output**: Generate appropriate files based on quest system type

### 3. Patchouli Guidebook Translation Workflow

1. **Detection**: Identify mods with Patchouli guidebooks
2. **Extraction**: Extract guidebook content from JAR files
3. **Chunking**: Divide content into manageable chunks
4. **Translation**: Send chunks to LLM for translation
5. **Combination**: Combine translated chunks
6. **Modification**: Modify the original JAR files to include translated content
