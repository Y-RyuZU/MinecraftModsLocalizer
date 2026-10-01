import { describe, expect, it } from "bun:test";
import { BaseLLMAdapter } from "../../adapters/base-llm-adapter";
import type { LLMConfig, TranslationRequest, TranslationResponse } from "../../types/llm";

class ContractAdapter extends BaseLLMAdapter {
  id = "test";
  name = "test";
  requiresApiKey = false;

  constructor(config: LLMConfig) {
    super(config);
  }

  async translate(_request: TranslationRequest): Promise<TranslationResponse> {
    throw new Error("not used in this test");
  }

  async validateApiKey(): Promise<boolean> {
    return true;
  }

  format(content: Record<string, string>, language: string): string {
    return this.formatUserPrompt(content, language);
  }

  parse(response: string): Record<string, string> {
    return this.parseResponse(response);
  }
}

describe("LLM JSON translation contract", () => {
  const input = { "quest.title": 'A "quoted" title', "quest.desc[0]": "line\\nnext" };

  it("sends key-value JSON and adds Japanese-specific wording only for Japanese", () => {
    const prompt = new ContractAdapter({
      provider: "test",
      apiKey: "",
      userPrompt: "Translate {{targetLanguage}}; {{line_count}} entries: {{content}}",
    });

    const japanese = prompt.format(input, "ja_jp");
    expect(japanese).toContain("Translate ja_jp; 2 entries:");
    expect(japanese).toContain(JSON.stringify(input));
    expect(japanese).toContain("katakana");
    expect(prompt.format(input, "de_de")).not.toContain("katakana");
  });

  it("accepts only a JSON object with string values", () => {
    const parser = new ContractAdapter({ provider: "test", apiKey: "" });
    expect(parser.parse('{"quest.title":"題名","quest.desc[0]":"説明"}')).toEqual({
      "quest.title": "題名",
      "quest.desc[0]": "説明",
    });
    expect(() => parser.parse("not JSON")).toThrow();
    expect(() => parser.parse('{"quest.title":42}')).toThrow(/values must all be strings/);
  });
});
