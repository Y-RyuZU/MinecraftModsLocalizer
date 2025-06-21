import { 
  mockModData, 
  mockQuestData, 
  mockGuidebookData,
  createMockTranslationResults,
  createMockTranslationJob 
} from '../mock-data';

describe('Mock Data', () => {
  describe('Mod Data', () => {
    it('should have simple mod data', () => {
      expect(mockModData.simpleMod).toBeDefined();
      expect(mockModData.simpleMod.modId).toBe('simple_mod');
      expect(Object.keys(mockModData.simpleMod.content)).toHaveLength(3);
    });

    it('should have complex mod data with many items', () => {
      expect(mockModData.complexMod).toBeDefined();
      expect(Object.keys(mockModData.complexMod.content)).toHaveLength(150);
    });

    it('should have special characters mod data', () => {
      expect(mockModData.specialMod).toBeDefined();
      expect(mockModData.specialMod.content['item.special_mod.formatted']).toContain('§a');
    });
  });

  describe('Quest Data', () => {
    it('should have simple quest data', () => {
      expect(mockQuestData.simpleQuest).toBeDefined();
      expect(mockQuestData.simpleQuest.id).toBe('quest_1');
    });

    it('should have complex quest data', () => {
      expect(mockQuestData.complexQuest).toBeDefined();
      expect(mockQuestData.complexQuest.content).toContain('Master Craftsman');
    });
  });

  describe('Guidebook Data', () => {
    it('should have simple book data', () => {
      expect(mockGuidebookData.simpleBook).toBeDefined();
      expect(mockGuidebookData.simpleBook.id).toBe('basic_guide');
    });

    it('should have advanced book data', () => {
      expect(mockGuidebookData.advancedBook).toBeDefined();
      expect(Object.keys(mockGuidebookData.advancedBook.content).length).toBeGreaterThan(50);
    });
  });

  describe('Translation Results', () => {
    it('should create mock translation results for Japanese', () => {
      const original = { 'test.key': 'Test Value' };
      const result = createMockTranslationResults(original, 'ja_jp');
      
      expect(result['test.key']).toContain('[ja_jp]');
    });

    it('should handle known translations', () => {
      const original = { 'item.simple_mod.test_item': 'Test Item' };
      const result = createMockTranslationResults(original, 'ja_jp');
      
      expect(result['item.simple_mod.test_item']).toBe('テストアイテム');
    });
  });

  describe('Translation Jobs', () => {
    it('should create translation jobs with correct structure', () => {
      const content = { 'test.key': 'test value' };
      const job = createMockTranslationJob(content, 'ja_jp', 'test.jar');
      
      expect(job.id).toMatch(/^test_job_\d+_[a-z0-9]+$/);
      expect(job.targetLanguage).toBe('ja_jp');
      expect(job.currentFileName).toBe('test.jar');
      expect(job.chunks).toHaveLength(1);
      expect(job.status).toBe('pending');
    });

    it('should create multiple chunks for large content', () => {
      const largeContent = Object.fromEntries(
        Array.from({ length: 150 }, (_, i) => [`key_${i}`, `value_${i}`])
      );
      
      const job = createMockTranslationJob(largeContent, 'ja_jp');
      
      expect(job.chunks.length).toBeGreaterThan(1);
      
      // Verify all content is preserved across chunks
      const allContent: Record<string, string> = {};
      job.chunks.forEach(chunk => {
        Object.assign(allContent, chunk.content);
      });
      
      expect(allContent).toEqual(largeContent);
    });
  });
});