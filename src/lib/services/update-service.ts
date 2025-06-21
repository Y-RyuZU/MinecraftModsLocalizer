import { invoke } from "@tauri-apps/api/core";

// GitHub repository details
const GITHUB_USER = 'Y-RyuZU';
const GITHUB_REPO = 'MinecraftModsLocalizer';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases/latest`;

// Cache duration (1 hour)
const CACHE_DURATION = 60 * 60 * 1000;

/**
 * Update check result
 */
export interface UpdateCheckResult {
  /** Whether an update is available */
  updateAvailable: boolean;
  /** Current version */
  currentVersion: string;
  /** Latest version */
  latestVersion: string;
  /** Release URL */
  releaseUrl?: string;
  /** Release notes */
  releaseNotes?: string;
  /** Error message if check failed */
  error?: string;
}

/**
 * GitHub release response
 */
interface GitHubRelease {
  tag_name: string;
  html_url: string;
  body?: string;
  published_at: string;
}

/**
 * Update service
 * Handles checking for application updates
 */
export class UpdateService {
  private static lastCheckTime: number = 0;
  private static lastCheckResult: UpdateCheckResult | null = null;
  
  /**
   * Get current application version
   * @returns Current version from package.json
   */
  private static getCurrentVersion(): string {
    // In a real implementation, this would be injected during build
    // For now, we'll use the version from package.json
    return "0.1.0";
  }
  
  /**
   * Compare two semantic versions
   * @param current Current version
   * @param latest Latest version
   * @returns true if latest is newer than current
   */
  private static isNewerVersion(current: string, latest: string): boolean {
    try {
      // Remove 'v' prefix if present
      const cleanCurrent = current.replace(/^v/, '');
      const cleanLatest = latest.replace(/^v/, '');
      
      // Split into parts
      const currentParts = cleanCurrent.split('.').map(p => parseInt(p, 10));
      const latestParts = cleanLatest.split('.').map(p => parseInt(p, 10));
      
      // Compare each part
      for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
        const currentPart = currentParts[i] || 0;
        const latestPart = latestParts[i] || 0;
        
        if (latestPart > currentPart) return true;
        if (latestPart < currentPart) return false;
      }
      
      return false;
    } catch (error) {
      console.error('Error comparing versions:', error);
      // Fall back to string comparison
      return latest > current;
    }
  }
  
  /**
   * Fetch latest release from GitHub
   * @returns GitHub release information
   */
  private static async fetchLatestRelease(): Promise<GitHubRelease> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(GITHUB_API_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          throw new Error('GitHub API rate limit exceeded. Please try again later.');
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data as GitHubRelease;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: Unable to reach GitHub API');
      }
      
      throw error;
    }
  }
  
  /**
   * Check for updates
   * @param forceCheck Force a new check even if cached
   * @returns Update check result
   */
  public static async checkForUpdates(forceCheck: boolean = false): Promise<UpdateCheckResult> {
    // Check cache if not forcing
    if (!forceCheck && this.lastCheckResult && (Date.now() - this.lastCheckTime) < CACHE_DURATION) {
      console.log('Returning cached update check result');
      return this.lastCheckResult;
    }
    
    const currentVersion = this.getCurrentVersion();
    
    try {
      console.log('Checking for updates...');
      await this.logMessage(`Checking for updates. Current version: ${currentVersion}`);
      
      const release = await this.fetchLatestRelease();
      const latestVersion = release.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
      
      const updateAvailable = this.isNewerVersion(currentVersion, latestVersion);
      
      const result: UpdateCheckResult = {
        updateAvailable,
        currentVersion,
        latestVersion,
        releaseUrl: release.html_url,
        releaseNotes: release.body,
      };
      
      // Cache the result
      this.lastCheckTime = Date.now();
      this.lastCheckResult = result;
      
      await this.logMessage(
        updateAvailable 
          ? `Update available: ${latestVersion} (current: ${currentVersion})`
          : `No update available. Current version (${currentVersion}) is up to date.`
      );
      
      return result;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to check for updates';
      console.error('Update check failed:', errorMessage);
      await this.logError(errorMessage);
      
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        error: errorMessage,
      };
    }
  }
  
  /**
   * Open external URL using Tauri
   * @param url URL to open
   */
  public static async openReleaseUrl(url: string): Promise<void> {
    try {
      await invoke('open_external_url', { url });
      await this.logMessage(`Opened release URL: ${url}`);
    } catch (error: any) {
      console.error('Failed to open URL:', error);
      await this.logError(`Failed to open URL: ${error.message || error}`);
      // Fallback to window.open if Tauri command fails
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
    }
  }
  
  /**
   * Log a message via Tauri
   * @param message Message to log
   */
  private static async logMessage(message: string): Promise<void> {
    try {
      await invoke('log_file_operation', { message: `[UpdateService] ${message}` });
    } catch (error) {
      console.log(`[UpdateService] ${message}`);
    }
  }
  
  /**
   * Log an error via Tauri
   * @param message Error message
   */
  private static async logError(message: string): Promise<void> {
    try {
      await invoke('log_error', { 
        message: `[UpdateService] ${message}`,
        processType: 'update_check'
      });
    } catch (error) {
      console.error(`[UpdateService] ${message}`);
    }
  }
}