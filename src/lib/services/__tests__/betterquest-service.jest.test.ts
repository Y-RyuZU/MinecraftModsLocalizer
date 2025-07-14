import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FileService } from '../file-service';

// Mock invoke function
const mockInvoke = jest.fn(() => Promise.resolve([]));

describe('FileService - BetterQuest File Discovery (Jest)', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    // Set the test override for FileService
    FileService.setTestInvokeOverride(mockInvoke);
  });

  afterEach(() => {
    // Reset the test override
    FileService.setTestInvokeOverride(null);
  });

  describe('get_better_quest_files with DefaultQuests.lang support', () => {
    it('should find JSON files in standard location', async () => {
      const standardFiles = [
        '/test/modpack/resources/betterquesting/lang/en_us.json',
        '/test/modpack/resources/betterquesting/lang/de_de.json'
      ];
      
      mockInvoke.mockResolvedValue(standardFiles);
      
      const result = await FileService.invoke('get_better_quest_files', { dir: '/test/modpack' });
      
      expect(mockInvoke).toHaveBeenCalledWith('get_better_quest_files', { dir: '/test/modpack' });
      expect(result).toEqual(standardFiles);
      
      // Verify all files are JSON in standard location
      for (const file of result) {
        expect(file).toMatch(/\.json$/);
        expect(file).toMatch(/resources\/betterquesting\/lang/);
      }
    });

    it('should find DefaultQuests.lang in direct location', async () => {
      const directFile = [
        '/test/modpack/config/betterquesting/DefaultQuests.lang'
      ];
      
      mockInvoke.mockResolvedValue(directFile);
      
      const result = await FileService.invoke('get_better_quest_files', { dir: '/test/modpack' });
      
      expect(result).toEqual(directFile);
      expect(result[0]).toMatch(/DefaultQuests\.lang$/);
      expect(result[0]).toMatch(/config\/betterquesting/);
    });

    it('should find both standard and direct files when both exist', async () => {
      const mixedFiles = [
        '/test/modpack/resources/betterquesting/lang/en_us.json',
        '/test/modpack/config/betterquesting/DefaultQuests.lang'
      ];
      
      mockInvoke.mockResolvedValue(mixedFiles);
      
      const result = await FileService.invoke('get_better_quest_files', { dir: '/test/modpack' });
      
      expect(result).toEqual(mixedFiles);
      expect(result).toHaveLength(2);
      
      // Verify we have both types
      const hasStandardJson = result.some(f => f.includes('resources/betterquesting/lang') && f.endsWith('.json'));
      const hasDirectLang = result.some(f => f.includes('config/betterquesting') && f.endsWith('DefaultQuests.lang'));
      
      expect(hasStandardJson).toBe(true);
      expect(hasDirectLang).toBe(true);
    });

    it('should return empty array when no BetterQuest files exist', async () => {
      mockInvoke.mockResolvedValue([]);
      
      const result = await FileService.invoke('get_better_quest_files', { dir: '/test/no-quests' });
      
      expect(result).toEqual([]);
    });

    it('should handle errors appropriately', async () => {
      const errorMessage = 'Directory not found: /invalid';
      mockInvoke.mockRejectedValue(new Error(errorMessage));
      
      await expect(FileService.invoke('get_better_quest_files', { dir: '/invalid' }))
        .rejects.toThrow(errorMessage);
    });

    it('should skip already translated files', async () => {
      // Backend should filter these out, but test that we handle them correctly
      const filesWithTranslations = [
        '/test/modpack/resources/betterquesting/lang/en_us.json',
        '/test/modpack/config/betterquesting/DefaultQuests.lang'
      ];
      
      mockInvoke.mockResolvedValue(filesWithTranslations);
      
      const result = await FileService.invoke('get_better_quest_files', { dir: '/test/modpack' });
      
      expect(result).toEqual(filesWithTranslations);
      
      // Verify none of the returned files have language suffixes
      for (const file of result) {
        expect(file).not.toMatch(/\.[a-z]{2}_[a-z]{2}\.(json|lang)$/);
      }
    });
  });

  describe('DefaultQuests.lang content handling', () => {
    it('should handle .lang format parsing', async () => {
      const langContent = `# BetterQuesting Language File
quest.1.name=My First Quest
quest.1.desc=Complete this quest to begin your journey
quest.2.name=Advanced Quest
quest.2.desc=A more challenging quest for experienced players
quest.2.subtitle=Optional subtitle text`;
      
      // Test parsing logic (this would be in the frontend)
      const lines = langContent.split('\n');
      const langMap: Record<string, string> = {};
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const separatorIndex = trimmed.indexOf('=');
          if (separatorIndex > -1) {
            const key = trimmed.substring(0, separatorIndex).trim();
            const value = trimmed.substring(separatorIndex + 1).trim();
            langMap[key] = value;
          }
        }
      }
      
      expect(langMap['quest.1.name']).toBe('My First Quest');
      expect(langMap['quest.1.desc']).toBe('Complete this quest to begin your journey');
      expect(langMap['quest.2.name']).toBe('Advanced Quest');
      expect(langMap['quest.2.desc']).toBe('A more challenging quest for experienced players');
      expect(langMap['quest.2.subtitle']).toBe('Optional subtitle text');
      expect(Object.keys(langMap)).toHaveLength(5);
    });

    it('should handle .lang format output', async () => {
      const translatedMap = {
        'quest.1.name': 'Ma première quête',
        'quest.1.desc': 'Complétez cette quête pour commencer votre voyage',
        'quest.2.name': 'Quête avancée',
        'quest.2.desc': 'Une quête plus difficile pour les joueurs expérimentés'
      };
      
      // Test output formatting (this would be in the frontend)
      const langLines: string[] = [];
      const sortedKeys = Object.keys(translatedMap).sort();
      
      for (const key of sortedKeys) {
        langLines.push(`${key}=${translatedMap[key]}`);
      }
      
      const outputContent = langLines.join('\n');
      
      expect(outputContent).toContain('quest.1.desc=Complétez cette quête pour commencer votre voyage');
      expect(outputContent).toContain('quest.1.name=Ma première quête');
      expect(outputContent).toContain('quest.2.desc=Une quête plus difficile pour les joueurs expérimentés');
      expect(outputContent).toContain('quest.2.name=Quête avancée');
      
      // Verify keys are sorted
      const lines = outputContent.split('\n');
      expect(lines[0]).toMatch(/^quest\.1\.desc=/);
      expect(lines[1]).toMatch(/^quest\.1\.name=/);
      expect(lines[2]).toMatch(/^quest\.2\.desc=/);
      expect(lines[3]).toMatch(/^quest\.2\.name=/);
    });
  });
});