import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
const apiLogs: string[] = [];
mock.module("@tauri-apps/api/core", () => ({
  invoke: async (command: string, args?: { message?: string }) => {
    if (command === "log_api_request" && args?.message) apiLogs.push(args.message);
    return undefined;
  }
}));
import { LLMAdapterFactory } from "../llm-adapter-factory";

type RecordedRequest = {
  path: string;
  headers: Headers;
  body: Record<string, unknown>;
};

const requests: RecordedRequest[] = [];
let retryableFailures = 0;
let batchOutput = "";
let batchErrorOutput = "";
let batchErrorCustomId: string | null = null;
let anthropicBatchOutput = "";
let server: ReturnType<typeof Bun.serve>;

function mockTranslatedJson(prompt: string): string {
  const source = JSON.parse(prompt.slice(prompt.lastIndexOf("\n") + 1)) as Record<string, string>;
  return JSON.stringify(Object.fromEntries(Object.entries(source).map(([key, value]) => [key, `訳: ${value}`])));
}

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const path = new URL(request.url).pathname;

      if (path.endsWith("/files") && request.method === "POST") {
        const form = await request.formData();
        const file = form.get("file");
        const input = file instanceof File ? await file.text() : "";
        requests.push({ path, headers: request.headers, body: { purpose: form.get("purpose"), jsonl: input } });
        return Response.json({ id: "file-input", object: "file", purpose: "batch", status: "processed", filename: "input.jsonl", bytes: input.length, created_at: 1 });
      }

      if (path.endsWith("/batches") && !path.includes("/messages/") && request.method === "POST") {
        const body = await request.json() as Record<string, unknown>;
        requests.push({ path, headers: request.headers, body });
        // The Batch API reads the uploaded JSONL file. Keep this local mock's fixture to one request.
        const uploaded = requests.slice().reverse().find((item) => item.path.endsWith("/files"))?.body.jsonl as string || "";
        const inputLines = uploaded.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
        const outputLines = inputLines.map((line) => {
          const id = line.custom_id as string;
          if (id === batchErrorCustomId) {
            return { failed: true, json: JSON.stringify({ custom_id: id, error: { code: "invalid_request_error", message: "temporary request failure" } }) };
          }
          const requestBody = line.body as Record<string, unknown>;
          const messages = requestBody.messages as Array<Record<string, unknown>>;
          const prompt = String(messages[1]?.content || "");
          const sourceJson = prompt.trim().split(/\r?\n/).at(-1) || "{}";
          const sourceContent = JSON.parse(sourceJson) as Record<string, string>;
          const translated = Object.fromEntries(Object.keys(sourceContent).map((key) => [key, `訳: ${sourceContent[key]}`]));
          return { failed: false, json: JSON.stringify({
            custom_id: id,
            response: {
              status_code: 200,
              body: {
                model: requestBody.model,
                choices: [{ message: { role: "assistant", content: JSON.stringify(translated) } }],
                usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 }
              }
            }
          }) };
        });
        batchOutput = outputLines.filter((line) => !line.failed).map((line) => line.json).reverse().join("\n");
        batchErrorOutput = outputLines.filter((line) => line.failed).map((line) => line.json).join("\n");
        return Response.json({
          id: "batch-test", object: "batch", status: "completed", endpoint: body.endpoint,
          input_file_id: body.input_file_id, output_file_id: "file-output",
          ...(batchErrorOutput ? { error_file_id: "file-error" } : {}), completion_window: "24h",
          created_at: 1, expires_at: 2, completed_at: 2,
          request_counts: { completed: outputLines.length - (batchErrorOutput ? 1 : 0), failed: batchErrorOutput ? 1 : 0, total: inputLines.length }
        });
      }

      if (path.endsWith("/files/file-output/content")) return new Response(batchOutput, { headers: { "content-type": "text/plain" } });
      if (path.endsWith("/files/file-error/content")) return new Response(batchErrorOutput, { headers: { "content-type": "text/plain" } });
      if (/\/files\/[^/]+$/.test(path) && request.method === "DELETE") {
        return Response.json({ id: path.split("/").at(-1), deleted: true, object: "file" });
      }

      if (path.endsWith("/messages/batches") && request.method === "POST") {
        const body = await request.json() as { requests: Array<{ custom_id: string; params: { model: string; messages: Array<{ content: string }> } }> };
        requests.push({ path, headers: request.headers, body: body as unknown as Record<string, unknown> });
        anthropicBatchOutput = body.requests.map(({ custom_id, params }) => JSON.stringify({
          custom_id,
          result: {
            type: "succeeded",
            message: {
              id: `msg-${custom_id}`, type: "message", role: "assistant", model: params.model,
              content: [{ type: "text", text: mockTranslatedJson(params.messages.at(-1)?.content || "") }],
              stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 3 }
            }
          }
        })).join("\n");
        return Response.json({
          id: "anthropic-batch-test", type: "message_batch", processing_status: "ended",
          created_at: "2026-01-01T00:00:00Z", expires_at: "2026-01-02T00:00:00Z", ended_at: "2026-01-01T00:00:01Z",
          archived_at: null, cancel_initiated_at: null, results_url: `${server.url}v1/messages/batches/anthropic-batch-test/results`,
          request_counts: { processing: 0, succeeded: body.requests.length, errored: 0, canceled: 0, expired: 0 }
        });
      }
      if (path.endsWith("/messages/batches/anthropic-batch-test") && request.method === "GET") {
        return Response.json({
          id: "anthropic-batch-test", type: "message_batch", processing_status: "ended",
          created_at: "2026-01-01T00:00:00Z", expires_at: "2026-01-02T00:00:00Z", ended_at: "2026-01-01T00:00:01Z",
          archived_at: null, cancel_initiated_at: null, results_url: `${server.url}v1/messages/batches/anthropic-batch-test/results`,
          request_counts: { processing: 0, succeeded: 2, errored: 0, canceled: 0, expired: 0 }
        });
      }
      if (path.endsWith("/messages/batches/anthropic-batch-test/results")) {
        return new Response(anthropicBatchOutput, { headers: { "content-type": "application/binary" } });
      }

      if (path.includes(":batchGenerateContent") && request.method === "POST") {
        const body = await request.json() as {
          batch: { inputConfig: { requests: { requests: Array<{ request: { contents: Array<{ parts: Array<{ text: string }> }> }; metadata: { key: string } }> } } };
        };
        requests.push({ path, headers: request.headers, body: body as unknown as Record<string, unknown> });
        const inlinedResponses = body.batch.inputConfig.requests.requests.map(({ request: item, metadata }) => ({
          metadata,
          response: {
            candidates: [{ content: { role: "model", parts: [{ text: mockTranslatedJson(item.contents[0].parts[0].text) }] }, finishReason: "STOP" }],
            modelVersion: "gemini-3.8-flash",
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3, totalTokenCount: 13 }
          }
        }));
        return Response.json({
          name: "batches/gemini-batch-test",
          metadata: {
            state: "JOB_STATE_SUCCEEDED", model: "gemini-3.8-flash",
            output: { inlinedResponses: { inlinedResponses } }
          }
        });
      }

      const body = await request.json() as Record<string, unknown>;
      requests.push({ path, headers: request.headers, body });

      if (retryableFailures > 0) {
        retryableFailures -= 1;
        return Response.json({ error: { message: "temporary overload" } }, { status: 503 });
      }

      if (path.includes("chat/completions")) {
        return Response.json({
          id: "chatcmpl-test",
          object: "chat.completion",
          model: "gpt-5-mini",
          choices: [{
            index: 0,
            message: { role: "assistant", content: "{\"item.example.name\": \"銅のつるはし\"}" },
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
          content: [{ type: "text", text: "{\"item.example.name\":\"銅のつるはし\"}" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 8 }
        });
      }

      return Response.json({
        candidates: [{
          content: {
            role: "model",
            parts: [{ text: "{\"item.example.name\":\"銅のつるはし\"}" }]
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
    expect(requests.at(-1)?.body.response_format).toEqual({ type: "json_object" });
  });

  test("uses low reasoning effort for GPT-6 Luna without temperature", async () => {
    const adapter = LLMAdapterFactory.getAdapter({
      provider: "openai",
      apiKey: "openai-test-key",
      baseUrl: server.url.toString(),
      model: "gpt-6-luna",
      temperature: 1,
      maxRetries: 0
    });

    await adapter.translate(request);

    const body = requests.at(-1)?.body;
    expect(body?.reasoning_effort).toBe("low");
    expect(body?.temperature).toBeUndefined();
  });

  test("submits multiple chunks as one discounted async Batch API job and maps results by custom_id", async () => {
    const adapter = LLMAdapterFactory.getAdapter({
      provider: "openai",
      apiKey: "openai-test-key",
      baseUrl: server.url.toString(),
      model: "gpt-6-luna",
      maxRetries: 0
    });
    const progress: Array<{ completed: number; total: number; status: string }> = [];

    const result = await adapter.translateBatch!([
      request,
      { content: { "item.example.tooltip": "Press Shift to upgrade" }, targetLanguage: "ja_jp" }
    ], { onProgress: (value) => progress.push(value) });

    expect(result).toHaveLength(2);
    expect(result[0].content["item.example.name"]).toBe("訳: Copper Pickaxe");
    expect(result[1].content["item.example.tooltip"]).toBe("訳: Press Shift to upgrade");
    const upload = requests.slice().reverse().find((item) => item.path.endsWith("/files"));
    expect(upload?.body.purpose).toBe("batch");
    expect(String(upload?.body.jsonl).split(/\r?\n/)).toHaveLength(2);
    const create = requests.slice().reverse().find((item) => item.path.endsWith("/batches"));
    expect(create?.body.completion_window).toBe("24h");
    expect(create?.body.endpoint).toBe("/v1/chat/completions");
    expect(progress.at(-1)).toMatchObject({ completed: 2, total: 2, status: "completed" });
    expect(apiLogs.at(-1)).toContain("tokens: input=20, output=4, total=24");
  });

  test("preserves per-request failures instead of failing successful Batch results", async () => {
    const adapter = LLMAdapterFactory.getAdapter({
      provider: "openai",
      apiKey: "openai-test-key",
      baseUrl: server.url.toString(),
      model: "gpt-6-luna",
      maxRetries: 0
    });
    batchErrorCustomId = "mml-1";
    try {
      const result = await adapter.translateBatch!([request, request]);
      expect(result[0].content["item.example.name"]).toBe("訳: Copper Pickaxe");
      expect(result[1].content).toEqual({});
      expect(result[1].metadata?.error).toContain("temporary request failure");
      expect(result[1].metadata?.errorRetryable).toBe(false);
    } finally {
      batchErrorCustomId = null;
    }
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
    const generationConfig = requests.at(-1)?.body.generationConfig as Record<string, unknown> | undefined;
    expect(generationConfig?.responseMimeType).toBe("application/json");
    expect(generationConfig?.maxOutputTokens).toBeUndefined();
    expect(generationConfig?.temperature).toBeUndefined();
  });

  test("submits keyed requests through Anthropic Message Batches and validates returned JSON", async () => {
    const adapter = LLMAdapterFactory.getAdapter({
      provider: "anthropic", apiKey: "anthropic-test-key", baseUrl: server.url.toString(),
      model: "claude-haiku-4-5-20251001", maxRetries: 0
    });
    const result = await adapter.translateBatch!([
      request,
      { content: { "item.example.tooltip": "Press Shift" }, targetLanguage: "ja_jp" }
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].content["item.example.name"]).toBe("訳: Copper Pickaxe");
    expect(result[1].content["item.example.tooltip"]).toBe("訳: Press Shift");
    const submission = requests.findLast((item) => item.path.endsWith("/messages/batches"));
    expect(submission?.headers.get("x-api-key")).toBe("anthropic-test-key");
    expect((submission?.body.requests as Array<{ custom_id: string }>).map(({ custom_id }) => custom_id)).toEqual(["mml-0", "mml-1"]);
  });

  test("submits keyed inline requests through Gemini Batch and maps returned keys", async () => {
    const adapter = LLMAdapterFactory.getAdapter({
      provider: "gemini", apiKey: "gemini-test-key", baseUrl: server.url.toString(),
      model: "gemini-3.8-flash", maxRetries: 0
    });
    const result = await adapter.translateBatch!([
      request,
      { content: { "item.example.tooltip": "Press Shift" }, targetLanguage: "ja_jp" }
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].content["item.example.name"]).toBe("訳: Copper Pickaxe");
    expect(result[1].content["item.example.tooltip"]).toBe("訳: Press Shift");
    const submission = requests.findLast((item) => item.path.includes(":batchGenerateContent"));
    expect(submission?.headers.get("x-goog-api-key")).toBe("gemini-test-key");
    expect(submission?.path).toContain("models/gemini-3.8-flash:batchGenerateContent");
    const inlined = ((submission?.body.batch as { inputConfig: { requests: { requests: Array<{ metadata: { key: string } }> } } }).inputConfig.requests.requests);
    expect(inlined.map(({ metadata }) => metadata.key)).toEqual(["mml-0", "mml-1"]);
  });

  test("retains temperature for Gemini 2.x models", async () => {
    const adapter = LLMAdapterFactory.getAdapter({
      provider: "gemini",
      apiKey: "gemini-test-key",
      baseUrl: server.url.toString(),
      model: "gemini-2.5-flash",
      temperature: 0.4,
      maxRetries: 0
    });

    await adapter.translate(request);

    const generationConfig = requests.at(-1)?.body.generationConfig as Record<string, unknown> | undefined;
    expect(generationConfig?.temperature).toBe(0.4);
  });

  test("leaves retries to the translation service", async () => {
    const requestCountBefore = requests.length;
    retryableFailures = 1;
    const adapter = LLMAdapterFactory.getAdapter({
      provider: "gemini",
      apiKey: "gemini-test-key",
      baseUrl: server.url.toString(),
      model: "gemini-3.8-flash",
      maxRetries: 5
    });

    await expect(adapter.translate(request)).rejects.toThrow();
    expect(requests.length - requestCountBefore).toBe(1);
  });
});
