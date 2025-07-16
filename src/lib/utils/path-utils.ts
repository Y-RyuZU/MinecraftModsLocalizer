/**
 * Cross-platform path utilities for handling file paths
 * Works correctly on Windows, macOS, and Linux
 */

/**
 * Get the file name from a path (cross-platform)
 * @param path Full path to extract filename from
 * @returns File name or "unknown" if extraction fails
 */
export function getFileName(path: string): string {
  if (!path) return "unknown";
  
  // Split by both forward slash and backslash
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || "unknown";
}

/**
 * Get the directory path from a file path (cross-platform)
 * @param path Full file path
 * @returns Directory path
 */
export function getDirectoryPath(path: string): string {
  if (!path) return "";
  
  // Split by both forward slash and backslash
  const parts = path.split(/[/\\]/);
  if (parts.length <= 1) return "";
  
  // Remove the last part (filename) and join with forward slash
  // This creates a normalized path that works on all platforms
  return parts.slice(0, -1).join('/');
}

/**
 * Calculate relative path from a base directory (cross-platform)
 * @param fullPath Full path to make relative
 * @param basePath Base directory path
 * @returns Relative path
 */
export function getRelativePath(fullPath: string, basePath: string): string {
  if (!fullPath || !basePath) return fullPath || "";
  
  // Normalize paths by replacing backslashes with forward slashes
  const normalizedFullPath = fullPath.replace(/\\/g, '/');
  const normalizedBasePath = basePath.replace(/\\/g, '/');
  
  // Ensure base path ends with a slash for proper comparison
  const baseWithSlash = normalizedBasePath.endsWith('/') 
    ? normalizedBasePath 
    : normalizedBasePath + '/';
  
  // Check if the full path starts with the base path
  if (normalizedFullPath.startsWith(baseWithSlash)) {
    return normalizedFullPath.substring(baseWithSlash.length);
  } else if (normalizedFullPath.startsWith(normalizedBasePath)) {
    // Handle case where paths match exactly or base doesn't end with slash
    const relative = normalizedFullPath.substring(normalizedBasePath.length);
    // Remove leading slash if present
    return relative.replace(/^[/\\]+/, '');
  }
  
  // If not a child of base path, return last 2 segments as fallback
  const parts = fullPath.split(/[/\\]/);
  if (parts.length >= 2) {
    return parts.slice(-2).join('/');
  }
  
  // Last resort: return just the filename
  return getFileName(fullPath);
}

/**
 * Join path segments (cross-platform)
 * @param segments Path segments to join
 * @returns Joined path using forward slashes
 */
export function joinPath(...segments: string[]): string {
  if (!segments || segments.length === 0) return "";
  
  // Filter out empty segments and join with forward slash
  return segments
    .filter(segment => segment && segment.length > 0)
    .join('/')
    .replace(/\/+/g, '/'); // Replace multiple slashes with single slash
}

/**
 * Normalize a path to use forward slashes (cross-platform)
 * @param path Path to normalize
 * @returns Normalized path with forward slashes
 */
export function normalizePath(path: string): string {
  if (!path) return "";
  return path.replace(/\\/g, '/');
}

/**
 * Check if a path is absolute (cross-platform)
 * @param path Path to check
 * @returns True if path is absolute
 */
export function isAbsolutePath(path: string): boolean {
  if (!path) return false;
  
  // Windows absolute paths: C:\, D:\, etc. or \\server\share
  if (/^[a-zA-Z]:[/\\]/.test(path) || /^\\\\/.test(path)) {
    return true;
  }
  
  // Unix absolute paths: /
  if (path.startsWith('/')) {
    return true;
  }
  
  return false;
}

/**
 * Get parent directory (cross-platform)
 * @param path Path to get parent from
 * @returns Parent directory path
 */
export function getParentDirectory(path: string): string {
  if (!path) return "";
  
  const normalized = normalizePath(path);
  const parts = normalized.split('/').filter(p => p.length > 0);
  
  if (parts.length <= 1) return "";
  
  // Remove last part and rejoin
  return parts.slice(0, -1).join('/');
}