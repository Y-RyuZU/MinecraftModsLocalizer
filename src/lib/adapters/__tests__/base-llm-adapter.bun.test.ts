import { describe, expect, test } from "bun:test";
import { BaseLLMAdapter } from "../base-llm-adapter";
import type { LLMConfig, TranslationRequest, TranslationResponse } from "../../types/llm";
import { DEFAULT_SYSTEM_PROMPT, JAPANESE_LOCALIZATION_PROMPT } from "../../types/llm";

class TestAdapter extends BaseLLMAdapter {
  id = "test";
  name = "Test";
  requiresApiKey = false;

  async translate(_request: TranslationRequest): Promise<TranslationResponse> {
    return { content: {} };
  }

  async validateApiKey(_apiKey: string): Promise<boolean> {
    return true;
  }

  parse(value: string, source: Record<string, string>) {
    return this.parseResponse(value, source);
  }

  formatUser(content: Record<string, string>, language: string) {
    return this.formatUserPrompt(content, language);
  }

  system(language: string) {
    return this.getSystemPrompt(language);
  }
}

const adapter = new TestAdapter({
  provider: "test",
  apiKey: "",
  maxRetries: 0
} satisfies LLMConfig);

describe("BaseLLMAdapter response parsing", () => {
  test("formats batches as JSON and applies Japanese guidance only for Japanese", () => {
    const prompt = adapter.formatUser({ "item.example.name": "Copper Pickaxe" }, "ja_jp");

    expect(prompt).toContain('{"item.example.name":"Copper Pickaxe"}');
    expect(prompt).toContain("into 日本語:");
    expect(prompt).not.toContain('\n  "item.example.name"');
    expect(DEFAULT_SYSTEM_PROMPT).toContain("Minecraft mod localization");
    expect(DEFAULT_SYSTEM_PROMPT).not.toContain("katakana");
    expect(adapter.system("ja_jp")).toContain(JAPANESE_LOCALIZATION_PROMPT);
    expect(adapter.system("Japanese")).toContain("readable katakana");
    expect(adapter.system("zh_cn")).not.toContain(JAPANESE_LOCALIZATION_PROMPT);
    expect(adapter.system("de_de")).not.toContain("katakana");
  });

  test("parses a valid JSON object", () => {
    expect(adapter.parse("{\"item.example.name\": \"銅のつるはし\"}", {
      "item.example.name": "Copper Pickaxe"
    })).toEqual({ "item.example.name": "銅のつるはし" });
  });

  test("rejects non-JSON and fenced output so the caller can retry", () => {
    expect(() => adapter.parse("```json\n{\"item.example.name\": \"銅のつるはし\"}\n```", {
      "item.example.name": "Copper Pickaxe"
    })).toThrow("Invalid JSON translation response");
    expect(() => adapter.parse("item.example.name: 銅のつるはし", {
      "item.example.name": "Copper Pickaxe"
    })).toThrow("Invalid JSON translation response");
  });

  test("rejects missing and extra keys", () => {
    expect(() => adapter.parse(JSON.stringify({
      "item.example.name": "銅のつるはし",
      "item.example.extra": "余計な値"
    }), {
      "item.example.name": "Copper Pickaxe"
    })).toThrow("keys do not match input");

    expect(() => adapter.parse(JSON.stringify({
      "item.example.extra": "余計な値"
    }), {
      "item.example.name": "Copper Pickaxe"
    })).toThrow("keys do not match input");
  });

  test("rejects non-string JSON values so the caller can retry", () => {
    expect(() => adapter.parse(JSON.stringify({
      "item.example.name": { translated: "銅のつるはし" }
    }), {
      "item.example.name": "Copper Pickaxe"
    })).toThrow("values must be strings");
  });
});
