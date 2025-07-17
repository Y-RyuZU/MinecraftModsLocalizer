/**
 * E2E Tests for FTB Quest Translation Logic
 * Tests the complete flow of FTB quest translation including:
 * 1. KubeJS lang file detection and translation
 * 2. Direct SNBT translation with content type detection
 * 3. Proper file naming and backup handling
 */

import { FileService } from '../file-service';
import { TranslationService } from '../translation-service';
import { runTranslationJobs } from '../translation-runner';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri API
jest.mock('@tauri-apps/api/core');
const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

// Mock file system operations
const mockFileSystem = {
  '/test/modpack/kubejs/assets/kubejs/lang/en_us.json': JSON.stringify({
    'ftbquests.quest.starter.title': 'Welcome to the Modpack',
    'ftbquests.quest.starter.description': 'Complete your first quest to get started.',
    'ftbquests.quest.mining.title': 'Mining Adventure',
    'ftbquests.quest.mining.description': 'Collect 64 stone blocks'
  }),
  '/test/modpack/config/ftbquests/quests/chapters/starter.snbt': `{
    title: "Welcome to the Modpack",
    description: "Complete your first quest to get started.",
    tasks: [{
      type: "item",
      item: "minecraft:stone",
      count: 1
    }]
  }`,
  '/test/modpack/config/ftbquests/quests/chapters/mining.snbt': `{
    title: "ftbquests.quest.mining.title",
    description: "ftbquests.quest.mining.description",
    tasks: [{
      type: "item",
      item: "minecraft:stone",
      count: 64
    }]
  }`
};

describe('FTB Quest Translation Logic E2E', () => {
  let translationService: TranslationService;
  let sessionId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock session ID generation
    sessionId = '2025-01-17_12-00-00';
    
    // Setup translation service
    translationService = new TranslationService({
      llmConfig: {
        provider: 'openai',
        apiKey: 'test-key',
        baseUrl: 'http://localhost:3000',
        model: 'gpt-4o-mini'
      },
      chunkSize: 50,
      promptTemplate: 'Translate the following to {targetLanguage}:\n{content}',
      maxRetries: 3
    });

    // Mock translation service to return predictable translations
    jest.spyOn(translationService, 'translateChunk').mockImplementation(
      async (chunk: string, targetLanguage: string) => {
        const translations: Record<string, string> = {
          'Welcome to the Modpack': 'モッドパックへようこそ',
          'Complete your first quest to get started.': '最初のクエストを完了して始めましょう。',
          'Mining Adventure': '採掘アドベンチャー',
          'Collect 64 stone blocks': '64個の石ブロックを集めよう'
        };
        
        if (chunk.includes('ftbquests.quest.starter.title')) {
          return chunk.replace('Welcome to the Modpack', 'モッドパックへようこそ');
        }
        
        return translations[chunk] || `[${targetLanguage}] ${chunk}`;
      }
    );
  });

  describe('KubeJS Lang File Translation', () => {
    beforeEach(() => {
      // Mock KubeJS file detection
      mockInvoke.mockImplementation((command: string, args: any) => {
        switch (command) {
          case 'get_ftb_quest_files':
            return Promise.resolve([
              {
                id: 'en_us_lang',
                name: 'en_us.json',
                path: '/test/modpack/kubejs/assets/kubejs/lang/en_us.json',
                questFormat: 'ftb'
              }
            ]);
          
          case 'generate_session_id':
            return Promise.resolve(sessionId);
          
          case 'create_logs_directory_with_session':
            return Promise.resolve(`/test/modpack/logs/localizer/${sessionId}`);
          
          case 'read_text_file':
            return Promise.resolve(mockFileSystem[args.path as keyof typeof mockFileSystem] || '');
          
          case 'write_text_file':
            return Promise.resolve(true);
          
          case 'check_quest_translation_exists':
            return Promise.resolve(false);
          
          case 'backup_snbt_files':
            return Promise.resolve(true);
          
          case 'update_translation_summary':
            return Promise.resolve(true);
          
          case 'log_translation_process':
            return Promise.resolve(true);
          
          default:
            return Promise.reject(new Error(`Unknown command: ${command}`));
        }
      });
    });

    it('should translate KubeJS lang files and create target language file', async () => {
      const targetLanguage = 'ja_jp';
      const jobs = [
        {
          id: 'test-job-1',
          chunks: [{
            id: 'chunk-1',
            content: JSON.stringify({
              'ftbquests.quest.starter.title': 'Welcome to the Modpack',
              'ftbquests.quest.starter.description': 'Complete your first quest to get started.',
              'ftbquests.quest.mining.title': 'Mining Adventure',
              'ftbquests.quest.mining.description': 'Collect 64 stone blocks'
            }),
            translatedContent: null,
            status: 'pending' as const
          }]
        }
      ];

      const results: any[] = [];
      let currentJobId: string | null = null;

      await runTranslationJobs({
        jobs,
        translationService,
        setCurrentJobId: (id) => { currentJobId = id; },
        incrementCompletedChunks: () => {},
        incrementWholeProgress: () => {},
        targetLanguage,
        type: 'ftb' as const,
        sessionId,
        getOutputPath: () => '/test/modpack/kubejs/assets/kubejs/lang/',
        getResultContent: () => ({}),
        writeOutput: async (job, outputPath, content) => {
          // Verify the correct output path for KubeJS files
          expect(outputPath).toBe('/test/modpack/kubejs/assets/kubejs/lang/');
          
          // Verify translated content structure
          expect(content).toContain('モッドパックへようこそ');
          expect(content).toContain('最初のクエストを完了して始めましょう。');
          
          // Mock file write
          await FileService.writeTextFile(
            `${outputPath}${targetLanguage}.json`,
            JSON.stringify(content)
          );
        },
        onResult: (result) => { results.push(result); }
      });

      // Verify write_text_file was called with correct path
      expect(mockInvoke).toHaveBeenCalledWith('write_text_file', {
        path: '/test/modpack/kubejs/assets/kubejs/lang/ja_jp.json',
        content: expect.stringContaining('モッドパックへようこそ')
      });

      // Verify translation summary was updated
      expect(mockInvoke).toHaveBeenCalledWith('update_translation_summary', {
        profileDirectory: expect.any(String),
        sessionId,
        translationType: 'ftb',
        name: expect.any(String),
        status: 'completed',
        translatedKeys: expect.any(Number),
        totalKeys: expect.any(Number)
      });
    });

    it('should skip translation if target language file already exists', async () => {
      // Mock existing target language file
      mockInvoke.mockImplementation((command: string, args: any) => {
        if (command === 'check_quest_translation_exists') {
          return Promise.resolve(true); // File exists
        }
        return Promise.resolve(true);
      });

      const targetLanguage = 'ja_jp';
      const jobs = [
        {
          id: 'test-job-1',
          chunks: [{
            id: 'chunk-1',
            content: JSON.stringify({
              'ftbquests.quest.starter.title': 'Welcome to the Modpack'
            }),
            translatedContent: null,
            status: 'pending' as const
          }]
        }
      ];

      const results: any[] = [];

      await runTranslationJobs({
        jobs,
        translationService,
        setCurrentJobId: () => {},
        incrementCompletedChunks: () => {},
        incrementWholeProgress: () => {},
        targetLanguage,
        type: 'ftb' as const,
        sessionId,
        getOutputPath: () => '/test/modpack/kubejs/assets/kubejs/lang/',
        getResultContent: () => ({}),
        writeOutput: async () => {},
        onResult: (result) => { results.push(result); }
      });

      // Verify that translation was skipped
      expect(mockInvoke).toHaveBeenCalledWith('check_quest_translation_exists', {
        questPath: expect.any(String),
        targetLanguage
      });
    });
  });

  describe('Direct SNBT Translation', () => {
    beforeEach(() => {
      // Mock direct SNBT translation scenario (no KubeJS files)
      mockInvoke.mockImplementation((command: string, args: any) => {
        switch (command) {
          case 'get_ftb_quest_files':
            return Promise.resolve([
              {
                id: 'starter_quest',
                name: 'starter.snbt',
                path: '/test/modpack/config/ftbquests/quests/chapters/starter.snbt',
                questFormat: 'ftb'
              }
            ]);
          
          case 'detect_snbt_content_type':
            return Promise.resolve('direct_text');
          
          case 'generate_session_id':
            return Promise.resolve(sessionId);
          
          case 'create_logs_directory_with_session':
            return Promise.resolve(`/test/modpack/logs/localizer/${sessionId}`);
          
          case 'read_text_file':
            return Promise.resolve(mockFileSystem[args.path as keyof typeof mockFileSystem] || '');
          
          case 'write_text_file':
            return Promise.resolve(true);
          
          case 'check_quest_translation_exists':
            return Promise.resolve(false);
          
          case 'backup_snbt_files':
            return Promise.resolve(true);
          
          case 'update_translation_summary':
            return Promise.resolve(true);
          
          case 'log_translation_process':
            return Promise.resolve(true);
          
          default:
            return Promise.reject(new Error(`Unknown command: ${command}`));
        }
      });
    });

    it('should translate SNBT files with direct text content in-place', async () => {
      const targetLanguage = 'ja_jp';
      const jobs = [
        {
          id: 'test-job-1',
          chunks: [{
            id: 'chunk-1',
            content: `{
              title: "Welcome to the Modpack",
              description: "Complete your first quest to get started.",
              tasks: [{
                type: "item",
                item: "minecraft:stone",
                count: 1
              }]
            }`,
            translatedContent: null,
            status: 'pending' as const
          }]
        }
      ];

      const results: any[] = [];

      await runTranslationJobs({
        jobs,
        translationService,
        setCurrentJobId: () => {},
        incrementCompletedChunks: () => {},
        incrementWholeProgress: () => {},
        targetLanguage,
        type: 'ftb' as const,
        sessionId,
        getOutputPath: () => '/test/modpack/config/ftbquests/quests/chapters/starter.snbt',
        getResultContent: () => ({}),
        writeOutput: async (job, outputPath, content) => {
          // Verify in-place translation (same file path)
          expect(outputPath).toBe('/test/modpack/config/ftbquests/quests/chapters/starter.snbt');
          
          // Verify translated content
          expect(content).toContain('モッドパックへようこそ');
          expect(content).toContain('最初のクエストを完了して始めましょう。');
          
          // Mock file write
          await FileService.writeTextFile(outputPath, content);
        },
        onResult: (result) => { results.push(result); }
      });

      // Verify backup was created before translation
      expect(mockInvoke).toHaveBeenCalledWith('backup_snbt_files', {
        files: ['/test/modpack/config/ftbquests/quests/chapters/starter.snbt'],
        sessionPath: `/test/modpack/logs/localizer/${sessionId}`
      });

      // Verify in-place file write
      expect(mockInvoke).toHaveBeenCalledWith('write_text_file', {
        path: '/test/modpack/config/ftbquests/quests/chapters/starter.snbt',
        content: expect.stringContaining('モッドパックへようこそ')
      });
    });

    it('should handle SNBT files with JSON key references', async () => {
      // Mock JSON key detection
      mockInvoke.mockImplementation((command: string, args: any) => {
        if (command === 'detect_snbt_content_type') {
          return Promise.resolve('json_keys');
        }
        // Return default mocks for other commands
        return Promise.resolve(true);
      });

      const targetLanguage = 'ja_jp';
      const jobs = [
        {
          id: 'test-job-1',
          chunks: [{
            id: 'chunk-1',
            content: `{
              title: "ftbquests.quest.mining.title",
              description: "ftbquests.quest.mining.description",
              tasks: [{
                type: "item",
                item: "minecraft:stone",
                count: 64
              }]
            }`,
            translatedContent: null,
            status: 'pending' as const
          }]
        }
      ];

      const results: any[] = [];

      await runTranslationJobs({
        jobs,
        translationService,
        setCurrentJobId: () => {},
        incrementCompletedChunks: () => {},
        incrementWholeProgress: () => {},
        targetLanguage,
        type: 'ftb' as const,
        sessionId,
        getOutputPath: () => '/test/modpack/config/ftbquests/quests/chapters/mining.snbt',
        getResultContent: () => ({}),
        writeOutput: async (job, outputPath, content) => {
          // For JSON key references, should create language-suffixed file
          expect(outputPath).toBe('/test/modpack/config/ftbquests/quests/chapters/mining.ja_jp.snbt');
          
          // Verify the keys are preserved (not translated)
          expect(content).toContain('ftbquests.quest.mining.title');
          expect(content).toContain('ftbquests.quest.mining.description');
          
          await FileService.writeTextFile(outputPath, content);
        },
        onResult: (result) => { results.push(result); }
      });

      // Verify content type detection was called
      expect(mockInvoke).toHaveBeenCalledWith('detect_snbt_content_type', {
        filePath: expect.stringContaining('mining.snbt')
      });
    });
  });

  describe('Translation Summary Integration', () => {
    it('should update translation summary with correct information', async () => {
      const targetLanguage = 'ja_jp';
      const jobs = [
        {
          id: 'test-job-1',
          chunks: [{
            id: 'chunk-1',
            content: JSON.stringify({
              'ftbquests.quest.starter.title': 'Welcome to the Modpack',
              'ftbquests.quest.starter.description': 'Complete your first quest to get started.'
            }),
            translatedContent: null,
            status: 'pending' as const
          }]
        }
      ];

      await runTranslationJobs({
        jobs,
        translationService,
        setCurrentJobId: () => {},
        incrementCompletedChunks: () => {},
        incrementWholeProgress: () => {},
        targetLanguage,
        type: 'ftb' as const,
        sessionId,
        getOutputPath: () => '/test/modpack/kubejs/assets/kubejs/lang/',
        getResultContent: () => ({}),
        writeOutput: async () => {},
        onResult: () => {}
      });

      // Verify translation summary was updated
      expect(mockInvoke).toHaveBeenCalledWith('update_translation_summary', {
        profileDirectory: expect.any(String),
        sessionId,
        translationType: 'ftb',
        name: expect.any(String),
        status: 'completed',
        translatedKeys: expect.any(Number),
        totalKeys: expect.any(Number)
      });
    });
  });
});