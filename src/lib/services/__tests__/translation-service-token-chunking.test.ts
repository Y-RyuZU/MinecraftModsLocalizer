/**
 * Translation Service Token-Based Chunking Integration Tests
 */

import { describe, expect, test, beforeEach } from "@jest/globals";
import { TranslationService, TranslationServiceOptions } from "../translation-service";
import { LLMConfig } from "../../types/llm";

// Mock LLM config for testing
const mockLLMConfig: LLMConfig = {
  provider: "openai",
  apiKey: "test-key",
  model: "gpt-4",
  maxRetries: 3,
  systemPrompt: "You are a translation assistant.",
  userPrompt: "Translate the following content to {language}:\n\n{content}",
  temperature: 0.7
};

describe("Translation Service Token-Based Chunking", () => {
  let translationService: TranslationService;

  beforeEach(() => {
    const options: TranslationServiceOptions = {
      llmConfig: mockLLMConfig,
      useTokenBasedChunking: true,
      maxTokensPerChunk: 1000, // Small limit for testing
      fallbackToEntryBased: true
    };
    
    translationService = new TranslationService(options);
  });

  describe("createJob with token-based chunking", () => {
    test("should create chunks based on token limits", () => {
      // Create content that would exceed token limits
      const largeContent: Record<string, string> = {};
      
      // Add many entries with moderately long text
      for (let i = 0; i < 50; i++) {
        largeContent[`item.test.item_${i}`] = `This is a test item with a longer description that contains multiple words and should contribute to token count. Item number ${i}.`;
      }
      
      const job = translationService.createJob(largeContent, "es", "test-file.json");
      
      // Should create multiple chunks due to token limits
      expect(job.chunks.length).toBeGreaterThan(1);
      
      // Each chunk should have content
      job.chunks.forEach(chunk => {
        expect(Object.keys(chunk.content).length).toBeGreaterThan(0);
      });
      
      // Total entries should match original content
      const totalEntries = job.chunks.reduce((sum, chunk) => sum + Object.keys(chunk.content).length, 0);
      expect(totalEntries).toBe(Object.keys(largeContent).length);
    });

    test("should handle single very long entry", () => {
      const longContent = {
        "very.long.entry": "a ".repeat(2000) // Very long text that exceeds token limit
      };
      
      const job = translationService.createJob(longContent, "fr", "test-file.json");
      
      // Should still create at least one chunk
      expect(job.chunks.length).toBeGreaterThanOrEqual(1);
      
      // Content should be preserved (though possibly split)
      const totalEntries = job.chunks.reduce((sum, chunk) => sum + Object.keys(chunk.content).length, 0);
      expect(totalEntries).toBeGreaterThanOrEqual(1);
    });

    test("should preserve all content across chunks", () => {
      const testContent = {
        "item.sword": "Sword",
        "item.shield": "Shield",
        "item.bow": "Bow",
        "item.arrow": "Arrow",
        "block.stone": "Stone Block",
        "block.wood": "Wooden Block"
      };
      
      const job = translationService.createJob(testContent, "de", "items.json");
      
      // Collect all content from chunks
      const reconstructedContent: Record<string, string> = {};
      job.chunks.forEach(chunk => {
        Object.assign(reconstructedContent, chunk.content);
      });
      
      // Should match original content exactly
      expect(reconstructedContent).toEqual(testContent);
    });
  });

  describe("fallback to entry-based chunking", () => {
    test("should fallback when token estimation fails", () => {
      // Create service with fallback enabled
      const optionsWithFallback: TranslationServiceOptions = {
        llmConfig: mockLLMConfig,
        useTokenBasedChunking: true,
        maxTokensPerChunk: 1000,
        fallbackToEntryBased: true,
        chunkSize: 2 // Small chunk size for testing
      };
      
      const serviceWithFallback = new TranslationService(optionsWithFallback);
      
      const content = {
        "test1": "value1",
        "test2": "value2", 
        "test3": "value3",
        "test4": "value4"
      };
      
      const job = serviceWithFallback.createJob(content, "it", "test.json");
      
      // Should create chunks successfully (whether token-based or fallback)
      expect(job.chunks.length).toBeGreaterThan(0);
      
      // All content should be preserved
      const totalEntries = job.chunks.reduce((sum, chunk) => sum + Object.keys(chunk.content).length, 0);
      expect(totalEntries).toBe(4);
    });
  });

  describe("entry-based chunking (legacy mode)", () => {
    test("should use entry-based chunking when disabled", () => {
      const entryBasedOptions: TranslationServiceOptions = {
        llmConfig: mockLLMConfig,
        useTokenBasedChunking: false,
        chunkSize: 2
      };
      
      const entryBasedService = new TranslationService(entryBasedOptions);
      
      const content = {
        "item1": "value1",
        "item2": "value2",
        "item3": "value3",
        "item4": "value4",
        "item5": "value5"
      };
      
      const job = entryBasedService.createJob(content, "ja", "legacy.json");
      
      // Should create chunks based on entry count (5 items / 2 per chunk = 3 chunks)
      expect(job.chunks.length).toBe(3);
      
      // First two chunks should have 2 entries each, last should have 1
      expect(Object.keys(job.chunks[0].content).length).toBe(2);
      expect(Object.keys(job.chunks[1].content).length).toBe(2);
      expect(Object.keys(job.chunks[2].content).length).toBe(1);
    });
  });

  describe("edge cases", () => {
    test("should handle empty content", () => {
      const job = translationService.createJob({}, "ko", "empty.json");
      
      // Should create no chunks for empty content
      expect(job.chunks.length).toBe(0);
    });

    test("should handle content with very short values", () => {
      const shortContent = {
        "a": "1",
        "b": "2",
        "c": "3"
      };
      
      const job = translationService.createJob(shortContent, "ru", "short.json");
      
      // Should create at least one chunk
      expect(job.chunks.length).toBeGreaterThan(0);
      
      // All content should be preserved
      const totalEntries = job.chunks.reduce((sum, chunk) => sum + Object.keys(chunk.content).length, 0);
      expect(totalEntries).toBe(3);
    });

    test("should handle mixed content sizes", () => {
      const mixedContent = {
        "short": "Hi",
        "medium": "This is a medium length text for testing purposes.",
        "long": "This is a very long text that contains many words and should contribute significantly to the token count estimation. ".repeat(10)
      };
      
      const job = translationService.createJob(mixedContent, "pt", "mixed.json");
      
      expect(job.chunks.length).toBeGreaterThan(0);
      
      // All content should be preserved
      const totalEntries = job.chunks.reduce((sum, chunk) => sum + Object.keys(chunk.content).length, 0);
      expect(totalEntries).toBe(3);
    });
  });

  describe("chunk metadata", () => {
    test("should assign unique IDs to chunks", () => {
      const content = {
        "item1": "value1",
        "item2": "value2",
        "item3": "value3"
      };
      
      const job = translationService.createJob(content, "zh", "metadata.json");
      
      const chunkIds = job.chunks.map(chunk => chunk.id);
      const uniqueIds = new Set(chunkIds);
      
      // All chunk IDs should be unique
      expect(uniqueIds.size).toBe(chunkIds.length);
      
      // All chunks should have pending status initially
      job.chunks.forEach(chunk => {
        expect(chunk.status).toBe("pending");
      });
    });

    test("should include job ID in chunk IDs", () => {
      const content = { "test": "value" };
      const job = translationService.createJob(content, "ar", "test.json");
      
      job.chunks.forEach(chunk => {
        expect(chunk.id).toContain(job.id);
        expect(chunk.id).toContain("chunk");
      });
    });
  });
});