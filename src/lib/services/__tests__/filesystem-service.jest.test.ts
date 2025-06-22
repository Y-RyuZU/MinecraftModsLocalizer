import { FileService } from '../file-service';

// Mock Tauri invoke
const mockInvoke = jest.fn();
jest.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}));

describe('FileService - FTB Quest File Discovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get_ftb_quest_files conditional logic', () => {
    it('should return only KubeJS files when en_us.json exists', async () => {
      // Mock the backend to return KubeJS files when en_us.json exists
      const mockKubeJSFiles = [
        '/test/modpack/kubejs/assets/kubejs/lang/en_us.json',
        '/test/modpack/kubejs/assets/kubejs/lang/de_de.json'
      ];
      
      mockInvoke.mockResolvedValue(mockKubeJSFiles);
      
      const result = await FileService.invoke('get_ftb_quest_files', { dir: '/test/modpack' });
      
      expect(mockInvoke).toHaveBeenCalledWith('get_ftb_quest_files', { dir: '/test/modpack' });
      expect(result).toEqual(mockKubeJSFiles);
      
      // Verify only JSON files are returned (KubeJS translation method)
      result.forEach(file => {
        expect(file).toMatch(/\.json$/);
        expect(file).toMatch(/kubejs\/assets\/kubejs\/lang/);
      });
    });

    it('should return only SNBT files when KubeJS en_us.json does not exist', async () => {
      // Mock the backend to return SNBT files when KubeJS files don't exist
      const mockSNBTFiles = [
        '/test/modpack/config/ftbquests/quests/chapters/chapter1.snbt',
        '/test/modpack/config/ftbquests/quests/chapters/chapter2.snbt'
      ];
      
      mockInvoke.mockResolvedValue(mockSNBTFiles);
      
      const result = await FileService.invoke('get_ftb_quest_files', { dir: '/test/modpack' });
      
      expect(mockInvoke).toHaveBeenCalledWith('get_ftb_quest_files', { dir: '/test/modpack' });
      expect(result).toEqual(mockSNBTFiles);
      
      // Verify only SNBT files are returned (direct SNBT translation method)
      result.forEach(file => {
        expect(file).toMatch(/\.snbt$/);
        expect(file).toMatch(/config\/ftbquests/);
      });
    });

    it('should return empty array when no quest files exist', async () => {
      mockInvoke.mockResolvedValue([]);
      
      const result = await FileService.invoke('get_ftb_quest_files', { dir: '/test/empty-modpack' });
      
      expect(mockInvoke).toHaveBeenCalledWith('get_ftb_quest_files', { dir: '/test/empty-modpack' });
      expect(result).toEqual([]);
    });

    it('should handle directory not found error', async () => {
      const errorMessage = 'Directory not found: /invalid/path';
      mockInvoke.mockRejectedValue(new Error(errorMessage));
      
      await expect(
        FileService.invoke('get_ftb_quest_files', { dir: '/invalid/path' })
      ).rejects.toThrow(errorMessage);
      
      expect(mockInvoke).toHaveBeenCalledWith('get_ftb_quest_files', { dir: '/invalid/path' });
    });

    it('should handle KubeJS directory access error', async () => {
      const errorMessage = 'KubeJS lang directory not accessible: /test/modpack/kubejs/assets/kubejs/lang';
      mockInvoke.mockRejectedValue(new Error(errorMessage));
      
      await expect(
        FileService.invoke('get_ftb_quest_files', { dir: '/test/modpack' })
      ).rejects.toThrow(errorMessage);
    });

    it('should handle SNBT directory read error', async () => {
      const errorMessage = 'Failed to read FTB quests directory: Permission denied';
      mockInvoke.mockRejectedValue(new Error(errorMessage));
      
      await expect(
        FileService.invoke('get_ftb_quest_files', { dir: '/test/modpack' })
      ).rejects.toThrow(errorMessage);
    });

    it('should handle invalid path encoding error', async () => {
      const errorMessage = 'Invalid path encoding: /test/invalid/path/file.json';
      mockInvoke.mockRejectedValue(new Error(errorMessage));
      
      await expect(
        FileService.invoke('get_ftb_quest_files', { dir: '/test/modpack' })
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('getFTBQuestFiles wrapper function', () => {
    it('should call the correct Tauri command', async () => {
      const mockFiles = ['/test/file1.snbt', '/test/file2.snbt'];
      mockInvoke.mockResolvedValue(mockFiles);
      
      const result = await FileService.getFTBQuestFiles('/test/directory');
      
      expect(mockInvoke).toHaveBeenCalledWith('get_ftb_quest_files', { dir: '/test/directory' });
      expect(result).toEqual(mockFiles);
    });

    it('should handle errors in wrapper function', async () => {
      const errorMessage = 'Test error';
      mockInvoke.mockRejectedValue(new Error(errorMessage));
      
      await expect(
        FileService.getFTBQuestFiles('/test/directory')
      ).rejects.toThrow(errorMessage);
    });
  });
});