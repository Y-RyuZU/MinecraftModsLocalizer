import { describe, expect, test } from "bun:test";
import { BaseLLMAdapter } from "../base-llm-adapter";
import type { LLMConfig, TranslationRequest, TranslationResponse } from "../../types/llm";
import { DEFAULT_SYSTEM_PROMPT } from "../../types/llm";

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
}

const adapter = new TestAdapter({
  provider: "test",
  apiKey: "",
  maxRetries: 0
} satisfies LLMConfig);

describe("BaseLLMAdapter response parsing", () => {
  test("formats batches as JSON and permits katakana for loanwords", () => {
    const prompt = adapter.formatUser({ "item.example.name": "Copper Pickaxe" }, "ja_jp");

    expect(prompt).toContain('"item.example.name": "Copper Pickaxe"');
    expect(DEFAULT_SYSTEM_PROMPT).toContain("use a readable katakana rendering");
  });

  test("parses fenced JSON responses", () => {
    expect(adapter.parse("```json\n{\"item.example.name\": \"銅のつるはし\"}\n```", {
      "item.example.name": "Copper Pickaxe"
    })).toEqual({ "item.example.name": "銅のつるはし" });
  });

  test("escapes special characters in line-format keys", () => {
    expect(adapter.parse("item.example.name: 銅のつるはし", {
      "item.example.name": "Copper Pickaxe"
    })).toEqual({ "item.example.name": "銅のつるはし" });
  });

  test("rejects JSON responses with missing or extra keys", () => {
    expect(() => adapter.parse(JSON.stringify({
      "item.example.name": "銅のつるはし",
      "item.example.extra": "余計な値"
    }), {
      "item.example.name": "Copper Pickaxe"
    })).toThrow(/extra/);
  });

  test("rejects JSON responses with non-string values", () => {
    expect(() => adapter.parse(JSON.stringify({
      "item.example.name": { translated: "銅のつるはし" }
    }), {
      "item.example.name": "Copper Pickaxe"
    })).toThrow(/non-string/);
  });
});
