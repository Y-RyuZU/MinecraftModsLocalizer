/**
 * Parse a .lang file content into a key-value map
 * @param content The content of the .lang file
 * @returns A map of key-value pairs
 */
export function parseLangFile(content: string): Record<string, string> {
  const langMap: Record<string, string> = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (trimmed && !trimmed.startsWith('#')) {
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex > -1) {
        const key = trimmed.substring(0, separatorIndex).trim();
        const value = trimmed.substring(separatorIndex + 1).trim();
        if (key) {
          langMap[key] = value;
        }
      }
    }
  }
  
  return langMap;
}

/**
 * Convert a key-value map to .lang file format
 * @param langMap The key-value map to convert
 * @returns The .lang file content
 */
export function stringifyLangFile(langMap: Record<string, string>): string {
  return Object.entries(langMap)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}