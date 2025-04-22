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

7. **Real-time Logging System**: We use Tauri's event system to emit log events from the backend to the frontend, which are displayed in real-time in a log dialog.

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
async fn translate_mod(mod_id: String, targetLanguage: String) -> Result<TranslationResult, String> {
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

2. **Tauri v2 API Detection**: We check for the presence of Tauri v2 specific APIs.

```typescript
// Check if we're running in a Tauri context
const isTauri = !isSSR && (
  typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined' || 
  typeof (window as unknown as Record<string, unknown>).isTauri !== 'undefined'
);
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

4. **Tauri v2 Invoke Function Access**: We safely access the invoke function from Tauri v2 APIs.

```typescript
// Get the Tauri invoke function
const getTauriInvokeFunction = () => {
  if (!isTauri || isSSR) return null;
  
  // Try to get the invoke function from Tauri v2 APIs
  if (typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined') {
    const tauriInternals = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ as Record<string, unknown>;
    if (typeof tauriInternals?.invoke === 'function') {
      return tauriInternals.invoke as <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    }
  }
  
  // Fallback to window.isTauri if available
  if (typeof (window as unknown as Record<string, unknown>).isTauri !== 'undefined') {
    const isTauriObj = (window as unknown as Record<string, unknown>).isTauri as Record<string, unknown>;
    if (typeof isTauriObj?.invoke === 'function') {
      return isTauriObj.invoke as <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    }
  }
  
  console.warn('Tauri detected but invoke function not found');
  return null;
};
```

5. **Mock Implementation**: We provide mock implementations for development and SSR contexts.

```typescript
// In SSR, always use mock
if (isSSR) {
  console.log(`[SSR] Using mock for command: ${command}`);
  return mockInvoke<T>(command, args);
}

const tauriAvailable = isTauri && tauriInvokeFunction;
if (tauriAvailable) {
  // Use the Tauri API
  return await tauriInvokeFunction<T>(command, args);
} else {
  // Use mock implementation
  return mockInvoke<T>(command, args);
}
```

6. **Tauri v2 Plugin Integration**: We use Tauri v2 plugins for specific functionality.

```typescript
// For dialog functionality, we use the dialog plugin
if (!dialogPlugin) {
  try {
    dialogPlugin = await import('@tauri-apps/plugin-dialog');
    console.log("FileService.openDirectoryDialog: Dialog plugin loaded successfully");
  } catch (error) {
    console.error("Failed to load dialog plugin:", error);
    // Fallback to invoke if plugin import fails
    return await tauriInvoke<string | null>("open_directory_dialog", { title });
  }
}

// Open the directory dialog using the plugin
const selected = await dialogPlugin.open({
  directory: true,
  multiple: false,
  title: title
});
```

7. **Plugin Registration**: We register plugins in the Rust backend.

```rust
// In lib.rs
.plugin(tauri_plugin_dialog::init())
```

8. **Plugin Permissions**: We add plugin permissions to the capabilities file.

```json
// In capabilities/default.json
"permissions": [
  "core:default",
  "dialog:allow-open"
]
```

9. **File System Operations**: We use standard Rust file operations instead of Tauri v2 file-system plugin.

```rust
// Instead of using Tauri's file-system plugin:
// app_handle.fs().create_dir_all(path)

// We use standard Rust file operations:
std::fs::create_dir_all(path)
```

This approach provides better reliability and reduces dependencies.

## Logging System Architecture

The application implements a comprehensive logging system that provides real-time feedback during translation operations:

1. **Backend Logging Implementation**:
   - Custom `TauriLogger` implementation in Rust that implements the `log::Log` trait
   - In-memory log buffer to store recent log entries
   - Event emission to the frontend for real-time updates
   - Log level filtering
   - Structured log entries with timestamp, level, message, and source information

2. **Frontend Log Components**:
   - `LogViewer` component for displaying logs with filtering and auto-scroll capabilities
   - `LogDialog` component for showing logs in a modal dialog
   - `LogButton` component for manually opening the log dialog
   - State management for log dialog visibility using Zustand

3. **Log Event Flow**:
   - Backend logs are created using the standard Rust `log` crate macros (info!, error!, etc.)
   - The `TauriLogger` captures these logs and emits them as Tauri events
   - The frontend listens for these events and updates the UI in real-time
   - The log dialog automatically opens when translation starts

4. **Translation Service Integration**:
   - The translation service logs detailed information about the translation process
   - Each step of the translation process is logged (job start, chunk processing, completion)
   - Errors and retries are logged for debugging purposes
   - Performance metrics (duration, success rate) are logged

Example of backend logging implementation:

```rust
// Backend (Rust)
// TauriLogger implementation
pub struct TauriLogger {
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    log_buffer: Arc<Mutex<VecDeque<LogEntry>>>,
}

impl Log for TauriLogger {
    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            let entry = LogEntry {
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string(),
                level: record.level().to_string(),
                message: format!("{}", record.args()),
                source: record.module_path().map(|s| s.to_string()),
                process_type: extract_process_type(&message),
            };
            
            self.add_log_entry(entry);
        }
    }
}

// Emit log event to frontend
fn add_log_entry(&self, entry: LogEntry) {
    if let Some(app_handle) = self.app_handle.lock().unwrap().as_ref() {
        let _ = app_handle.emit("log", &entry);
    }
}
```

Example of frontend log event handling:

```typescript
// Frontend (Next.js)
// Listen for log events
useEffect(() => {
  const listenForLogs = async () => {
    try {
      if (typeof window !== 'undefined' && 
          typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined') {
        const unlistenFn = await listen<LogEntry>('log', (event) => {
          setLogs(prevLogs => [...prevLogs, event.payload]);
        });
        
        return unlistenFn;
      }
    } catch (error) {
      console.error('Failed to listen for log events:', error);
    }
    
    return () => {};
  };
  
  const unlistenPromise = listenForLogs();
  
  return () => {
    unlistenPromise.then(unlisten => unlisten && unlisten());
  };
}, []);
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
