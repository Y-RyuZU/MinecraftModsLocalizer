import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

mock.module("@tauri-apps/api/core", () => ({ invoke: async () => undefined }));

import { TranslationService } from "../translation-service";

type RecordedRequest = {
  path: string;
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
      requests.push({ path, body });

      if (path.includes("chat/completions")) {
        return Response.json({
          id: "chatcmpl-service-test",
          object: "chat.completion",
          model: "gpt-5-mini",
          choices: [{
            index: 0,
            message: {
              role: "assistant",
              content: "{\"item.example.name\": \"銅のつるはし\"}"
            },
            finish_reason: "stop"
          }]
        });
      }

      if (path.endsWith("/messages")) {
        return Response.json({
          id: "msg-service-test",
          type: "message",
          role: "assistant",
          model: "claude-haiku-4-5-20251001",
          content: [{
            type: "text",
            text: "item.example.name: 銅のつるはし"
          }],
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

describe("TranslationService HTTP flow", () => {
  test.each([
    ["openai", "openai-test-key", "gpt-5-mini"],
    ["anthropic", "anthropic-test-key", "claude-haiku-4-5-20251001"],
    ["gemini", "gemini-test-key", "gemini-3.8-flash"]
  ] as const)("runs a complete %s translation job", async (provider, apiKey, model) => {
    requests.length = 0;
    const completedJobs: string[] = [];

    const service = new TranslationService({
      llmConfig: {
        provider,
        apiKey,
        baseUrl: server.url.toString(),
        model,
        maxRetries: 0
      },
      chunkSize: 1,
      onComplete: (completedJob) => completedJobs.push(completedJob.id)
    });

    const job = service.createJob(
      { "item.example.name": "Copper Pickaxe" },
      "ja_jp",
      "test.lang"
    );

    const result = await service.startJob(job.id);

    expect(result.status).toBe("completed");
    expect(result.progress).toBe(100);
    expect(service.getCombinedTranslatedContent(job.id)).toEqual({
      "item.example.name": "銅のつるはし"
    });
    expect(completedJobs).toEqual([job.id]);
    expect(requests).toHaveLength(1);
  });
});
