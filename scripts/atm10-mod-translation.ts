import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { TranslationService } from "../src/lib/services/translation-service";
import { DEFAULT_CHUNK_SIZE, DEFAULT_MODELS, normalizeProvider, PROVIDER_DEFINITIONS } from "../src/lib/types/config";

if (typeof window === "undefined") {
  (globalThis as unknown as { window: { __TAURI_INTERNALS__: { invoke: () => Promise<undefined> } } }).window = {
    __TAURI_INTERNALS__: { invoke: async () => undefined }
  };
}

const sourcePath = process.env.MML_MOD_SOURCE;
const modId = process.env.MML_MOD_ID;
if (!sourcePath || !modId) {
  throw new Error("MML_MOD_SOURCE and MML_MOD_ID are required.");
}

const outputRoot = process.env.MML_SAMPLE_OUTPUT || join(tmpdir(), `mml-mod-sample-${Date.now()}`);
const targetLanguage = "ja_jp";
const provider = normalizeProvider(process.env.MML_PROVIDER || "openai");
const providerDefinition = PROVIDER_DEFINITIONS[provider];
const environmentVariables = [
  providerDefinition.environmentVariable,
  providerDefinition.alternativeEnvironmentVariable
].filter((name): name is string => Boolean(name));
const model = process.env.MML_MODEL || DEFAULT_MODELS[provider];
const apiKey = process.env.MML_API_KEY || environmentVariables
  .map((name) => process.env[name])
  .find((value) => Boolean(value));
if (!apiKey) {
  throw new Error(`Missing ${providerDefinition.environmentVariable}.`);
}

const source = JSON.parse(await readFile(sourcePath, "utf8")) as Record<string, string>;
if (Object.values(source).some((value) => typeof value !== "string")) {
  throw new Error(`Source language file contains non-string values: ${sourcePath}`);
}

const service = new TranslationService({
  llmConfig: {
    provider,
    apiKey,
    model,
    maxRetries: 0,
    temperature: 0.2
  },
  chunkSize: DEFAULT_CHUNK_SIZE,
  maxRetries: 0,
  currentFileName: sourcePath
});
const job = service.createJob(source, targetLanguage, sourcePath);
const completed = await service.startJob(job.id);
if (completed.status !== "completed") {
  const errors = completed.chunks
    .map((chunk) => chunk.error)
    .filter((error): error is string => Boolean(error));
  throw new Error(`Translation failed: ${errors.join(" | ") || completed.error || "unknown error"}`);
}

const translated = service.getCombinedTranslatedContent(job.id);
const sourceKeys = Object.keys(source);
const translatedKeys = Object.keys(translated);
const missing = sourceKeys.filter((key) => !Object.prototype.hasOwnProperty.call(translated, key));
const extra = translatedKeys.filter((key) => !Object.prototype.hasOwnProperty.call(source, key));
const invalid = sourceKeys.filter((key) => typeof translated[key] !== "string");
if (missing.length || extra.length || invalid.length) {
  throw new Error(`Invalid translation schema (missing: ${missing.join(", ")}; extra: ${extra.join(", ")}; non-string: ${invalid.join(", ")})`);
}

const outputPath = join(outputRoot, "assets", modId, "lang", `${targetLanguage}.json`);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(translated, null, 2) + "\n", "utf8");

console.log(JSON.stringify({
  provider,
  model,
  modId,
  source: sourcePath,
  output: outputPath,
  entries: sourceKeys.length,
  batchSize: DEFAULT_CHUNK_SIZE,
  requestCount: Math.ceil(sourceKeys.length / DEFAULT_CHUNK_SIZE),
  sample: Object.fromEntries(sourceKeys.slice(0, 5).map((key) => [key, translated[key]]))
}, null, 2));
