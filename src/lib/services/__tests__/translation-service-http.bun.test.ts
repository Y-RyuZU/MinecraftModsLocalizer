import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

mock.module("@tauri-apps/api/core", () => ({ invoke: async () => undefined }));

import { TranslationService } from "../translation-service";
import { DEFAULT_CHUNK_SIZE } from "../../types/config";

type RecordedRequest = {
  path: string;
  body: Record<string, unknown>;
};

const requests: RecordedRequest[] = [];
let server: ReturnType<typeof Bun.serve>;
let forcedStatus: number | undefined;

function responseFor(body: Record<string, unknown>, path: string): string {
  let prompt = "";
  if (path.includes("chat/completions")) {
    const messages = body.messages as Array<{ content?: string }>;
    prompt = messages.at(-1)?.content || "";
  } else if (path.endsWith("/messages")) {
    const messages = body.messages as Array<{ content?: string }>;
    prompt = messages.at(-1)?.content || "";
  } else {
    const contents = body.contents as Array<{ parts?: Array<{ text?: string }> }>;
    prompt = contents?.at(-1)?.parts?.at(-1)?.text || "";
  }

  const start = prompt.indexOf("{");
  const end = prompt.lastIndexOf("}");
  const source = JSON.parse(prompt.slice(start, end + 1)) as Record<string, string>;
  return JSON.stringify(Object.fromEntries(
    Object.keys(source).map((key) => [
      key,
      source[key] === "Copper Pickaxe" ? "銅のつるはし" : `訳:${source[key]}`
    ])
  ));
}

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const body = await request.json() as Record<string, unknown>;
      const path = new URL(request.url).pathname;
      requests.push({ path, body });
      if (forcedStatus) {
        return Response.json({ error: { code: forcedStatus, message: "Prepayment credits are depleted" } }, { status: forcedStatus });
      }

      if (path.includes("chat/completions")) {
        return Response.json({
          id: "chatcmpl-service-test",
          object: "chat.completion",
          model: "gpt-5-mini",
          choices: [{
            index: 0,
            message: {
              role: "assistant",
              content: responseFor(body, path)
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
            text: responseFor(body, path)
          }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 8 }
        });
      }

      return Response.json({
        candidates: [{
          content: {
            role: "model",
            parts: [{ text: responseFor(body, path) }]
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

  test("sends a multi-entry batch in one request and preserves every key", async () => {
    requests.length = 0;
    const source = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [`item.example.${index}`, `Copper Pickaxe ${index}`])
    );
    const service = new TranslationService({
      llmConfig: {
        provider: "gemini",
        apiKey: "gemini-test-key",
        baseUrl: server.url.toString(),
        model: "gemini-3.8-flash",
        maxRetries: 0
      },
      chunkSize: DEFAULT_CHUNK_SIZE
    });
    const job = service.createJob(source, "ja_jp");

    const result = await service.startJob(job.id);

    expect(result.status).toBe("completed");
    expect(requests).toHaveLength(1);
    expect(service.getCombinedTranslatedContent(job.id)).toEqual(
      Object.fromEntries(Object.entries(source).map(([key, value]) => [key, `訳:${value}`]))
    );
  });

  test.each([400, 402, 429])("stops after one billing error (HTTP %i) instead of retrying every batch", async (status) => {
    requests.length = 0;
    forcedStatus = status;
    try {
      const service = new TranslationService({
        llmConfig: {
          provider: "gemini",
          apiKey: "gemini-test-key",
          baseUrl: server.url.toString(),
          model: "gemini-3.8-flash",
          maxRetries: 3
        },
        chunkSize: 1,
        maxRetries: 3
      });
      const job = service.createJob({ first: "One", second: "Two" }, "ja_jp");

      const result = await service.startJob(job.id);

      expect(result.status).toBe("failed");
      expect(requests).toHaveLength(1);
    } finally {
      forcedStatus = undefined;
    }
  });

  test.each([
    ["openai", "openai-test-key", "gpt-6-luna"],
    ["anthropic", "anthropic-test-key", "claude-haiku-4-5-20251001"],
    ["gemini", "gemini-test-key", "gemini-3.8-flash"]
  ] as const)("does not retry an exhausted-credit 429 for %s", async (provider, apiKey, model) => {
    requests.length = 0;
    forcedStatus = 429;
    try {
      const service = new TranslationService({
        llmConfig: { provider, apiKey, baseUrl: server.url.toString(), model, maxRetries: 3 },
        chunkSize: 1,
        maxRetries: 3
      });
      const job = service.createJob({ first: "One", second: "Two" }, "ja_jp");

      const result = await service.startJob(job.id);

      expect(result.status).toBe("failed");
      expect(requests).toHaveLength(1);
    } finally {
      forcedStatus = undefined;
    }
  });
});
