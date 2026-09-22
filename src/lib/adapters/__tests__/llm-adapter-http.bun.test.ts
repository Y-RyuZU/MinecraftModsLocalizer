import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
mock.module("@tauri-apps/api/core", () => ({ invoke: async () => undefined }));
import { LLMAdapterFactory } from "../llm-adapter-factory";

type RecordedRequest = {
  path: string;
  headers: Headers;
  body: Record<string, unknown>;
};

const requests: RecordedRequest[] = [];
let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const body = await request.json() as Record<string, unknown>;
      const path = new URL(request.url).pathname;
      requests.push({ path, headers: request.headers, body });

      if (path.includes("chat/completions")) {
        return Response.json({
          id: "chatcmpl-test",
          object: "chat.completion",
          model: "gpt-5-mini",
          choices: [{
            index: 0,
            message: { role: "assistant", content: "```json\n{\"item.example.name\": \"銅のつるはし\"}\n```" },
            finish_reason: "stop"
          }],
          usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 }
        });
      }

      if (path.endsWith("/messages")) {
        return Response.json({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-haiku-4-5-20251001",
          content: [{ type: "text", text: "item.example.name: 銅のつるはし" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 8 }
        });
      }

      return Response.json({
        candidates: [{
          content: {
            role: "model",
            parts: [{ text: "item.example.name: 銅のつるはし" }]
          },
          finishReason: "STOP"
        }],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 8,
          totalTokenCount: 18
        },
        modelVersion: "gemini-3.8-flash"
      });
    }
  });
});

afterAll(() => server.stop());

const source = { "item.example.name": "Copper Pickaxe" };
const request = { content: source, targetLanguage: "ja_jp" };

describe("LLM adapter HTTP integrations", () => {
  test("translates through the OpenAI-compatible endpoint", async () => {
    const adapter = LLMAdapterFactory.getAdapter({
      provider: "openai",
      apiKey: "openai-test-key",
      baseUrl: server.url.toString(),
      model: "gpt-5-mini",
      maxRetries: 0
    });

    await expect(adapter.translate(request)).resolves.toMatchObject({
      content: { "item.example.name": "銅のつるはし" }
    });
    expect(requests.at(-1)?.path).toContain("chat/completions");
    expect(requests.at(-1)?.headers.get("authorization")).toBe("Bearer openai-test-key");
  });

  test("translates through the Anthropic messages endpoint", async () => {
    const adapter = LLMAdapterFactory.getAdapter({
      provider: "anthropic",
      apiKey: "anthropic-test-key",
      baseUrl: server.url.toString(),
      model: "claude-haiku-4-5-20251001",
      maxRetries: 0
    });

    await expect(adapter.translate(request)).resolves.toMatchObject({
      content: { "item.example.name": "銅のつるはし" }
    });
    expect(requests.at(-1)?.path).toEndWith("/messages");
    expect(requests.at(-1)?.headers.get("x-api-key")).toBe("anthropic-test-key");
  });

  test("translates through the current Gemini SDK endpoint", async () => {
    const adapter = LLMAdapterFactory.getAdapter({
      provider: "gemini",
      apiKey: "gemini-test-key",
      baseUrl: server.url.toString(),
      model: "gemini-3.8-flash",
      maxRetries: 0
    });

    await expect(adapter.translate(request)).resolves.toMatchObject({
      content: { "item.example.name": "銅のつるはし" }
    });
    expect(requests.at(-1)?.path).toContain("generateContent");
  });
});
