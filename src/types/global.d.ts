declare global {
  interface Window {
    __TAURI_DEBUG__?: boolean;
  }
}

export {};