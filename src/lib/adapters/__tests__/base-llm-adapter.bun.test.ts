import { describe, expect, test } from "bun:test";
import { BaseLLMAdapter } from "../base-llm-adapter";
import type { LLMConfig, TranslationRequest, TranslationResponse } from "../../types/llm";

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
}

const adapter = new TestAdapter({
  provider: "test",
  apiKey: "",
  maxRetries: 0
} satisfies LLMConfig);

describe("BaseLLMAdapter response parsing", () => {
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
});
