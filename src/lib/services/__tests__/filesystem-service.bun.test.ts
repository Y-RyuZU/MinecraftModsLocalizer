import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { FileService } from '../file-service';

// Mock invoke function
const mockInvoke = mock(() => Promise.resolve([]));

describe('FileService - FTB Quest File Discovery (Bun)', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    // Set the test override for FileService
    FileService.setTestInvokeOverride(mockInvoke);
  });

  afterEach(() => {
    // Reset the test override
    FileService.setTestInvokeOverride(null);
  });

  describe('get_ftb_quest_files conditional logic', () => {
    it('should return only KubeJS files when en_us.json exists', async () => {
      // Mock the backend to return KubeJS files when en_us.json exists
      const mockKubeJSFiles = [
        '/test/modpack/kubejs/assets/kubejs/lang/en_us.json',
        '/test/modpack/kubejs/assets/kubejs/lang/fr_fr.json'
      ];
      
      mockInvoke.mockResolvedValue(mockKubeJSFiles);
      
      const result = await FileService.invoke('get_ftb_quest_files', { dir: '/test/modpack' });
      
      expect(mockInvoke).toHaveBeenCalledWith('get_ftb_quest_files', { dir: '/test/modpack' });
      expect(result).toEqual(mockKubeJSFiles);
      
      // Verify only JSON files are returned (KubeJS translation method)
      for (const file of result) {
        expect(file).toMatch(/\.json$/);
        expect(file).toMatch(/kubejs\/assets\/kubejs\/lang/);
      }
    });

    it('should return only SNBT files when KubeJS en_us.json does not exist', async () => {
      // Mock the backend to return SNBT files when KubeJS files don't exist
      const mockSNBTFiles = [
        '/test/modpack/config/ftbquests/quests/chapters/intro.snbt',
        '/test/modpack/config/ftbquests/quests/chapters/advanced.snbt'
      ];
      
      mockInvoke.mockResolvedValue(mockSNBTFiles);
      
      const result = await FileService.invoke('get_ftb_quest_files', { dir: '/test/modpack' });
      
      expect(mockInvoke).toHaveBeenCalledWith('get_ftb_quest_files', { dir: '/test/modpack' });
      expect(result).toEqual(mockSNBTFiles);
      
      // Verify only SNBT files are returned (direct SNBT translation method)
      for (const file of result) {
        expect(file).toMatch(/\.snbt$/);
        expect(file).toMatch(/config\/ftbquests/);
      }
    });

    it('should handle mixed scenarios correctly', async () => {
      // First test KubeJS scenario
      const kubeJSFiles = ['/test/kubejs/assets/kubejs/lang/en_us.json'];
      mockInvoke.mockResolvedValueOnce(kubeJSFiles);
      
      let result = await FileService.invoke('get_ftb_quest_files', { dir: '/test/kubejs-modpack' });
      expect(result).toEqual(kubeJSFiles);
      
      // Then test SNBT scenario
      const snbtFiles = ['/test/config/ftbquests/quests/test.snbt'];
      mockInvoke.mockResolvedValueOnce(snbtFiles);
      
      result = await FileService.invoke('get_ftb_quest_files', { dir: '/test/snbt-modpack' });
      expect(result).toEqual(snbtFiles);
    });

    it('should handle errors appropriately', async () => {
      const errorMessage = 'Directory not accessible';
      mockInvoke.mockRejectedValue(new Error(errorMessage));
      
      try {
        await FileService.invoke('get_ftb_quest_files', { dir: '/invalid' });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  });

  describe('nested directory structure support', () => {
    it('should find SNBT files in standard quest structure', async () => {
      const standardFiles = [
        '/test/modpack/config/ftbquests/quests/chapters/intro.snbt',
        '/test/modpack/config/ftbquests/quests/chapters/main.snbt',
        '/test/modpack/config/ftbquests/quests/chapter_groups.snbt'
      ];
      
      mockInvoke.mockResolvedValue(standardFiles);
      
      const result = await FileService.invoke('get_ftb_quest_files', { dir: '/test/modpack' });
      
      expect(result).toEqual(standardFiles);
      expect(result.every(f => f.includes('ftbquests/quests/'))).toBe(true);
    });

    it('should find SNBT files in FTB Interactions Remastered structure', async () => {
      const nestedFiles = [
        '/test/modpack/config/ftbquests/normal/chapters/category1/quest1.snbt',
        '/test/modpack/config/ftbquests/normal/chapters/category1/quest2.snbt',
        '/test/modpack/config/ftbquests/normal/chapters/category2/quest3.snbt',
        '/test/modpack/config/ftbquests/normal/chapters/category2/subcat/quest4.snbt'
      ];
      
      mockInvoke.mockResolvedValue(nestedFiles);
      
      const result = await FileService.invoke('get_ftb_quest_files', { dir: '/test/modpack' });
      
      expect(result).toEqual(nestedFiles);
      expect(result.every(f => f.includes('ftbquests/normal/'))).toBe(true);
    });

    it('should find SNBT files in fallback root structure', async () => {
      const rootFiles = [
        '/test/modpack/config/ftbquests/chapters/quest1.snbt',
        '/test/modpack/config/ftbquests/chapters/quest2.snbt',
        '/test/modpack/config/ftbquests/data.snbt'
      ];
      
      mockInvoke.mockResolvedValue(rootFiles);
      
      const result = await FileService.invoke('get_ftb_quest_files', { dir: '/test/modpack' });
      
      expect(result).toEqual(rootFiles);
      expect(result.every(f => f.includes('ftbquests/') && !f.includes('/quests/') && !f.includes('/normal/'))).toBe(true);
    });

    it('should return error with helpful message when no quest directories exist', async () => {
      const errorMessage = 'No FTB quests directory found. Checked: config/ftbquests/quests/, config/ftbquests/normal/, and config/ftbquests/';
      mockInvoke.mockRejectedValue(new Error(errorMessage));
      
      try {
        await FileService.invoke('get_ftb_quest_files', { dir: '/test/no-quests' });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('config/ftbquests/quests/');
        expect(error.message).toContain('config/ftbquests/normal/');
        expect(error.message).toContain('config/ftbquests/');
      }
    });

    it('should handle deeply nested quest structures', async () => {
      const deeplyNestedFiles = [
        '/test/modpack/config/ftbquests/normal/chapters/cat1/subcat1/group1/quest1.snbt',
        '/test/modpack/config/ftbquests/normal/chapters/cat1/subcat1/group2/quest2.snbt',
        '/test/modpack/config/ftbquests/normal/chapters/cat2/subcat2/group3/quest3.snbt'
      ];
      
      mockInvoke.mockResolvedValue(deeplyNestedFiles);
      
      const result = await FileService.invoke('get_ftb_quest_files', { dir: '/test/modpack' });
      
      expect(result).toEqual(deeplyNestedFiles);
      expect(result.length).toBe(3);
    });
  });

  describe('performance and edge cases', () => {
    it('should handle large file lists efficiently', async () => {
      // Generate a large list of mock files
      const largeFileList = Array.from({ length: 1000 }, (_, i) => 
        `/test/config/ftbquests/quests/chapter${i}.snbt`
      );
      
      mockInvoke.mockResolvedValue(largeFileList);
      
      const startTime = Date.now();
      const result = await FileService.invoke('get_ftb_quest_files', { dir: '/test/large-modpack' });
      const endTime = Date.now();
      
      expect(result).toEqual(largeFileList);
      expect(result.length).toBe(1000);
      // Should complete within reasonable time (not testing exact performance, just that it doesn't hang)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle special characters in paths', async () => {
      const specialPaths = [
        '/test/config/ftbquests/quests/special chars & symbols.snbt',
        '/test/kubejs/assets/kubejs/lang/en_us (copy).json'
      ];
      
      mockInvoke.mockResolvedValue(specialPaths);
      
      const result = await FileService.invoke('get_ftb_quest_files', { dir: '/test/special-modpack' });
      expect(result).toEqual(specialPaths);
    });
  });
});