import { describe, expect, test } from "bun:test";
import { LLMAdapterFactory } from "../llm-adapter-factory";

describe("LLMAdapterFactory", () => {
  test("creates all supported providers with fresh configuration", () => {
    const configs = [
      { provider: "openai", model: "gpt-5-mini" },
      { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
      { provider: "gemini", model: "gemini-3.8-flash" },
      { provider: "google", model: "gemini-3.8-flash" }
    ];

    const adapters = configs.map((config) => LLMAdapterFactory.getAdapter({
      ...config,
      apiKey: "test-key",
      maxRetries: 0
    }));

    expect(adapters.map((adapter) => adapter.id)).toEqual([
      "openai",
      "anthropic",
      "gemini",
      "gemini"
    ]);
    expect(LLMAdapterFactory.getAvailableAdapterTypes().map((adapter) => adapter.id)).toEqual([
      "openai",
      "anthropic",
      "gemini"
    ]);
  });

  test("does not reuse credentials after configuration changes", () => {
    const first = LLMAdapterFactory.getAdapter({
      provider: "openai",
      apiKey: "first-key",
      model: "gpt-5-mini",
      maxRetries: 0
    });
    const second = LLMAdapterFactory.getAdapter({
      provider: "openai",
      apiKey: "second-key",
      model: "gpt-5-mini",
      maxRetries: 0
    });

    expect(second).not.toBe(first);
  });
});
