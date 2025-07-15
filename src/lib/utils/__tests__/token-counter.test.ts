/**
 * Token Counter Utility Tests
 */

import { describe, expect, test } from "@jest/globals";
import {
  estimateTokens,
  exceedsTokenLimit,
  calculateOptimalChunkSize,
  estimateTokensForProvider,
  DEFAULT_TOKEN_CONFIG
} from "../token-counter";

describe("Token Counter Utility", () => {
  describe("estimateTokens", () => {
    test("should estimate tokens for simple content", () => {
      const content = {
        "hello": "world",
        "foo": "bar"
      };
      
      const result = estimateTokens(content);
      
      expect(result.wordCount).toBe(4); // "hello", "world", "foo", "bar"
      expect(result.entryCount).toBe(2);
      expect(result.contentTokens).toBe(Math.ceil(4 * DEFAULT_TOKEN_CONFIG.wordToTokenRatio));
      expect(result.totalTokens).toBeGreaterThan(result.contentTokens); // Should include overhead
    });

    test("should handle empty content", () => {
      const result = estimateTokens({});
      
      expect(result.wordCount).toBe(0);
      expect(result.entryCount).toBe(0);
      expect(result.contentTokens).toBe(0);
      expect(result.totalTokens).toBeGreaterThan(0); // Should still have overhead
    });

    test("should handle content with special characters", () => {
      const content = {
        "item.minecraft.diamond_sword": "Diamond Sword",
        "gui.button.cancel": "Cancel Operation"
      };
      
      const result = estimateTokens(content);
      
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.entryCount).toBe(2);
    });

    test("should use custom configuration", () => {
      const content = { "test": "content" };
      const customConfig = {
        wordToTokenRatio: 2.0,
        systemPromptOverhead: 200
      };
      
      const result = estimateTokens(content, customConfig);
      
      expect(result.contentTokens).toBe(Math.ceil(2 * 2.0)); // 2 words * 2.0 ratio
    });
  });

  describe("exceedsTokenLimit", () => {
    test("should return true when content exceeds limit", () => {
      const largeContent = {
        "test": "a ".repeat(1000) // Very long content
      };
      
      const exceeds = exceedsTokenLimit(largeContent, 100);
      expect(exceeds).toBe(true);
    });

    test("should return false when content is within limit", () => {
      const smallContent = {
        "hello": "world"
      };
      
      const exceeds = exceedsTokenLimit(smallContent, 1000);
      expect(exceeds).toBe(false);
    });
  });

  describe("calculateOptimalChunkSize", () => {
    test("should calculate reasonable chunk size", () => {
      const sampleContent = {
        "key1": "short value",
        "key2": "another short value",
        "key3": "yet another value"
      };
      
      const chunkSize = calculateOptimalChunkSize(sampleContent, 1000);
      
      expect(chunkSize).toBeGreaterThan(0);
      expect(chunkSize).toBeLessThanOrEqual(100); // Capped at reasonable maximum
    });

    test("should return at least 1 for very large content", () => {
      const largeContent = {
        "huge": "a ".repeat(10000)
      };
      
      const chunkSize = calculateOptimalChunkSize(largeContent, 100);
      expect(chunkSize).toBe(1);
    });

    test("should handle empty content", () => {
      const chunkSize = calculateOptimalChunkSize({}, 1000);
      expect(chunkSize).toBe(1);
    });
  });

  describe("estimateTokensForProvider", () => {
    test("should provide different estimates for different providers", () => {
      const content = {
        "test": "sample content for testing"
      };
      
      const openaiResult = estimateTokensForProvider(content, "openai");
      const anthropicResult = estimateTokensForProvider(content, "anthropic");
      const geminiResult = estimateTokensForProvider(content, "gemini");
      
      // All should have the same word count and entry count
      expect(openaiResult.wordCount).toBe(anthropicResult.wordCount);
      expect(openaiResult.entryCount).toBe(anthropicResult.entryCount);
      
      // But different token estimates due to different ratios
      expect(openaiResult.totalTokens).not.toBe(anthropicResult.totalTokens);
      expect(anthropicResult.totalTokens).not.toBe(geminiResult.totalTokens);
    });

    test("should handle unknown provider gracefully", () => {
      const content = { "test": "content" };
      
      // This should not throw and should use default config
      const result = estimateTokensForProvider(content, "unknown" as any);
      expect(result.totalTokens).toBeGreaterThan(0);
    });
  });

  describe("word counting edge cases", () => {
    test("should handle multiple spaces correctly", () => {
      const content = {
        "spaced": "word1    word2     word3"
      };
      
      const result = estimateTokens(content);
      expect(result.wordCount).toBe(4); // "spaced", "word1", "word2", "word3"
    });

    test("should handle empty strings", () => {
      const content = {
        "empty": "",
        "whitespace": "   ",
        "normal": "word"
      };
      
      const result = estimateTokens(content);
      expect(result.wordCount).toBe(4); // Keys: "empty" (1), "whitespace" (1), "normal" (1), Values: "word" (1)
    });

    test("should handle special characters in keys", () => {
      const content = {
        "item.minecraft.stone_sword": "Stone Sword",
        "gui.inventory.title": "Inventory"
      };
      
      const result = estimateTokens(content);
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.entryCount).toBe(2);
    });
  });
});