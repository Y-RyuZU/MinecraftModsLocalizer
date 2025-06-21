import { UpdateService } from '../update-service';

describe('UpdateService', () => {
  describe('Version Comparison', () => {
    // Access the private method using bracket notation for testing
    const isNewerVersion = (UpdateService as any).isNewerVersion;
    
    it('should correctly compare semantic versions', () => {
      // Basic version comparisons
      expect(isNewerVersion('1.0.0', '2.0.0')).toBe(true);
      expect(isNewerVersion('1.0.0', '1.1.0')).toBe(true);
      expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true);
      
      // Same versions
      expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
      
      // Older versions
      expect(isNewerVersion('2.0.0', '1.0.0')).toBe(false);
      expect(isNewerVersion('1.1.0', '1.0.0')).toBe(false);
      expect(isNewerVersion('1.0.1', '1.0.0')).toBe(false);
    });
    
    it('should handle versions with v prefix', () => {
      expect(isNewerVersion('v1.0.0', 'v2.0.0')).toBe(true);
      expect(isNewerVersion('v1.0.0', '2.0.0')).toBe(true);
      expect(isNewerVersion('1.0.0', 'v2.0.0')).toBe(true);
      expect(isNewerVersion('v2.0.0', 'v1.0.0')).toBe(false);
    });
    
    it('should handle versions with different number of parts', () => {
      expect(isNewerVersion('1.0', '1.0.1')).toBe(true);
      expect(isNewerVersion('1.0.0', '1.1')).toBe(true);
      expect(isNewerVersion('1', '1.0.1')).toBe(true);
      expect(isNewerVersion('1.0.1', '1.0')).toBe(false);
    });
    
    it('should handle pre-release versions', () => {
      // For simplicity, our implementation treats these as regular versions
      expect(isNewerVersion('1.0.0', '1.0.1-alpha')).toBe(true);
      expect(isNewerVersion('1.0.0-beta', '1.0.0')).toBe(false);
    });
    
    it('should handle edge cases', () => {
      expect(isNewerVersion('0.0.1', '0.0.2')).toBe(true);
      expect(isNewerVersion('0.1.0', '0.0.9')).toBe(false);
      expect(isNewerVersion('10.0.0', '9.9.9')).toBe(false);
      expect(isNewerVersion('1.10.0', '1.9.0')).toBe(false);
    });
  });
  
  describe('Cache Management', () => {
    beforeEach(() => {
      // Reset cache before each test
      (UpdateService as any).lastCheckTime = 0;
      (UpdateService as any).lastCheckResult = null;
    });
    
    it('should cache results for subsequent calls', async () => {
      // Mock fetch for this test
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: 'v1.0.0',
          html_url: 'https://github.com/test/releases/v1.0.0',
          body: 'Test release notes'
        })
      });
      global.fetch = mockFetch;
      
      // First call should make a request
      await UpdateService.checkForUpdates();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      await UpdateService.checkForUpdates();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Force check should make a new request
      await UpdateService.checkForUpdates(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});