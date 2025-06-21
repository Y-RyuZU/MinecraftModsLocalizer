import { ModTranslationTarget, QuestTranslationTarget, GuidebookTranslationTarget } from '@/lib/types/minecraft';
import { TranslationJob, TranslationChunk } from '@/lib/services/translation-service';

/**
 * Mock Minecraft Mod translation data
 */
export const mockModData = {
  // Simple mod with basic translations
  simpleMod: {
    modId: 'simple_mod',
    name: 'Simple Test Mod',
    path: '/test/mods/simple_mod.jar',
    content: {
      'item.simple_mod.test_item': 'Test Item',
      'block.simple_mod.test_block': 'Test Block',
      'entity.simple_mod.test_entity': 'Test Entity'
    }
  },
  
  // Complex mod with many translations
  complexMod: {
    modId: 'complex_mod',
    name: 'Complex Test Mod',
    path: '/test/mods/complex_mod.jar',
    content: Object.fromEntries(
      Array.from({ length: 150 }, (_, i) => [
        `item.complex_mod.item_${i}`,
        `Complex Item ${i}`
      ])
    )
  },

  // Mod with special characters and formatting
  specialMod: {
    modId: 'special_mod',
    name: 'Special Characters Mod',
    path: '/test/mods/special_mod.jar',
    content: {
      'item.special_mod.formatted': '§aGreen Text §r§lBold Text',
      'item.special_mod.tooltip': 'Line 1\\nLine 2\\nLine 3',
      'item.special_mod.placeholder': 'Value: %s, Count: %d',
      'item.special_mod.unicode': 'Unicode: ★ ♠ ♥ ♦ ♣',
      'gui.special_mod.title': '§6§lSpecial GUI Title§r'
    }
  }
};

/**
 * Mock Quest translation data
 */
export const mockQuestData = {
  simpleQuest: {
    id: 'quest_1',
    name: 'Simple Quest',
    path: '/test/quests/simple_quest.snbt',
    content: `{
      id: "quest_1"
      title: "Gather Resources"
      description: "Collect 10 wood logs to start your journey"
      objectives: [
        {
          type: "item"
          item: "minecraft:oak_log"
          count: 10
        }
      ]
    }`
  },

  complexQuest: {
    id: 'quest_complex',
    name: 'Complex Quest Chain',
    path: '/test/quests/complex_quest.snbt',
    content: `{
      id: "quest_complex"
      title: "Master Craftsman"
      description: "Complete a series of crafting challenges to become a master craftsman. This quest will test your knowledge of advanced recipes and resource management."
      subtitle: "The Path to Mastery"
      tasks: [
        {
          id: "craft_tools"
          title: "Craft Basic Tools"
          description: "Create a full set of iron tools"
        }
        {
          id: "advanced_crafting"
          title: "Advanced Recipes"
          description: "Master complex crafting combinations"
        }
      ]
      rewards: [
        {
          type: "xp"
          amount: 1000
          description: "Experience Points"
        }
      ]
    }`
  }
};

/**
 * Mock Guidebook translation data
 */
export const mockGuidebookData = {
  simpleBook: {
    id: 'basic_guide',
    modId: 'test_mod',
    name: 'Basic Guide',
    path: '/test/guidebooks/basic_guide.json',
    content: {
      'patchouli.basic_guide.landing_text': 'Welcome to the Basic Guide! This book will help you get started.',
      'patchouli.basic_guide.category.basics': 'Basics',
      'patchouli.basic_guide.entry.getting_started': 'Getting Started',
      'patchouli.basic_guide.page.intro.title': 'Introduction',
      'patchouli.basic_guide.page.intro.text': 'This is your introduction to the world of modded Minecraft.'
    }
  },

  advancedBook: {
    id: 'advanced_guide',
    modId: 'advanced_mod',
    name: 'Advanced Techniques',
    path: '/test/guidebooks/advanced_guide.json',
    content: Object.fromEntries([
      // Landing page
      ['patchouli.advanced_guide.landing_text', 'Master advanced techniques with this comprehensive guide.'],
      
      // Categories
      ...Array.from({ length: 5 }, (_, i) => [
        `patchouli.advanced_guide.category.section_${i}`,
        `Advanced Section ${i + 1}`
      ]),
      
      // Entries
      ...Array.from({ length: 20 }, (_, i) => [
        `patchouli.advanced_guide.entry.technique_${i}`,
        `Advanced Technique ${i + 1}`
      ]),
      
      // Pages
      ...Array.from({ length: 50 }, (_, i) => [
        `patchouli.advanced_guide.page.content_${i}.text`,
        `This is the content for page ${i + 1}. It contains detailed information about advanced techniques and methodologies.`
      ])
    ])
  }
};

/**
 * Mock translation targets
 */
export const createMockModTarget = (modData: typeof mockModData.simpleMod): ModTranslationTarget => ({
  type: 'mod',
  modId: modData.modId,
  name: modData.name,
  path: modData.path,
  selected: true,
  isEnabled: true,
  totalTranslations: Object.keys(modData.content).length,
  hasExistingTranslation: false
});

export const createMockQuestTarget = (questData: typeof mockQuestData.simpleQuest): QuestTranslationTarget => ({
  type: 'quest',
  id: questData.id,
  name: questData.name,
  path: questData.path,
  selected: true,
  content: questData.content
});

export const createMockGuidebookTarget = (bookData: typeof mockGuidebookData.simpleBook): GuidebookTranslationTarget => ({
  type: 'guidebook',
  id: bookData.id,
  modId: bookData.modId,
  name: bookData.name,
  path: bookData.path,
  selected: true,
  content: bookData.content,
  totalPages: Object.keys(bookData.content).length
});

/**
 * Mock translation jobs
 */
export const createMockTranslationJob = (
  content: Record<string, string>,
  targetLanguage: string = 'ja_jp',
  fileName?: string
): TranslationJob => {
  const jobId = `test_job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const chunkSize = 50;
  const entries = Object.entries(content);
  const chunks: TranslationChunk[] = [];

  // Split content into chunks
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunkEntries = entries.slice(i, i + chunkSize);
    const chunkContent: Record<string, string> = {};
    
    for (const [key, value] of chunkEntries) {
      chunkContent[key] = value;
    }
    
    chunks.push({
      id: `${jobId}_chunk_${chunks.length}`,
      content: chunkContent,
      status: "pending"
    });
  }

  return {
    id: jobId,
    targetLanguage,
    chunks,
    status: "pending",
    progress: 0,
    startTime: Date.now(),
    currentFileName: fileName
  };
};

/**
 * Mock translation results
 */
export const createMockTranslationResults = (originalContent: Record<string, string>, targetLanguage: string = 'ja_jp'): Record<string, string> => {
  const mockTranslations: Record<string, Record<string, string>> = {
    ja_jp: {
      'item.simple_mod.test_item': 'テストアイテム',
      'block.simple_mod.test_block': 'テストブロック',
      'entity.simple_mod.test_entity': 'テストエンティティ',
      'Gather Resources': 'リソースを集める',
      'Collect 10 wood logs': '木のログを10個集める',
      'Welcome to the Basic Guide!': '基本ガイドへようこそ！',
      'Getting Started': 'はじめに',
      'Introduction': '紹介'
    },
    zh_cn: {
      'item.simple_mod.test_item': '测试物品',
      'block.simple_mod.test_block': '测试方块',
      'entity.simple_mod.test_entity': '测试实体',
      'Gather Resources': '收集资源',
      'Collect 10 wood logs': '收集10个木原木',
      'Welcome to the Basic Guide!': '欢迎来到基础指南！',
      'Getting Started': '入门',
      'Introduction': '介绍'
    }
  };

  const translations = mockTranslations[targetLanguage] || mockTranslations.ja_jp;
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(originalContent)) {
    // Try to find a translation for the key or value
    result[key] = translations[key] || translations[value] || `[${targetLanguage}] ${value}`;
  }

  return result;
};

/**
 * Mock progress tracking data
 */
export const createMockProgressData = (totalChunks: number, completedChunks: number = 0) => ({
  totalChunks,
  completedChunks,
  progress: totalChunks > 0 ? Math.round((completedChunks / totalChunks) * 100) : 0,
  isTranslating: completedChunks < totalChunks && completedChunks > 0,
  wholeProgress: totalChunks > 0 ? Math.round((completedChunks / totalChunks) * 100) : 0
});

/**
 * Mock error scenarios
 */
export const mockErrorScenarios = {
  networkError: new Error('Network request failed'),
  apiKeyError: new Error('API key is not configured'),
  parseError: new Error('Response line count (519) does not match original content line count (1)'),
  timeoutError: new Error('Request timeout after 30 seconds'),
  rateLimitError: new Error('Rate limit exceeded. Please try again later.'),
  invalidResponseError: new Error('Invalid response format from translation service')
};