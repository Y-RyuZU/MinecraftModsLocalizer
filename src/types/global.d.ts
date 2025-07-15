declare global {
  interface Window {
    __TAURI_DEBUG__?: boolean;
    __TAURI_INTERNALS__?: {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
    isTauri?: boolean;
  }
}

export {};