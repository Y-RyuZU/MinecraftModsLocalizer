import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TranslationService } from "../src/lib/services/translation-service";
import { applyQuestTranslations, extractQuestText } from "../src/lib/services/quest-text";
import { DEFAULT_CHUNK_SIZE, DEFAULT_MODELS, normalizeProvider, PROVIDER_DEFINITIONS } from "../src/lib/types/config";

// The real app provides Tauri logging commands. The sample runner uses the
// same service outside Tauri, so make those optional logs no-ops in Bun.
if (typeof window === "undefined") {
  (globalThis as unknown as { window: { __TAURI_INTERNALS__: { invoke: () => Promise<undefined> } } }).window = {
    __TAURI_INTERNALS__: { invoke: async () => undefined }
  };
}

const instanceRoot = process.env.MML_ATM10_ROOT;
if (!instanceRoot) {
  throw new Error("MML_ATM10_ROOT must point to the ATM10 SKY minecraft directory.");
}

const provider = normalizeProvider(process.env.MML_PROVIDER || "gemini");
const providerDefinition = PROVIDER_DEFINITIONS[provider];
const environmentVariables = [
  providerDefinition.environmentVariable,
  providerDefinition.alternativeEnvironmentVariable
].filter((name): name is string => Boolean(name));
const apiKey = process.env.MML_API_KEY || environmentVariables
  .map((name) => process.env[name])
  .find((value) => Boolean(value));
const model = process.env.MML_MODEL || DEFAULT_MODELS[provider];
const outputRoot = process.env.MML_SAMPLE_OUTPUT || join(tmpdir(), `mml-atm10-sample-${Date.now()}`);

if (!apiKey) {
  throw new Error(`Missing ${providerDefinition.environmentVariable}.`);
}

const llmConfig = {
  provider,
  apiKey,
  model,
  maxRetries: 0,
  temperature: 0.2
};

async function translate(content: Record<string, string>, fileName: string): Promise<Record<string, string>> {
  const service = new TranslationService({
    llmConfig,
    chunkSize: DEFAULT_CHUNK_SIZE,
    maxRetries: 0,
    currentFileName: fileName
  });
  const job = service.createJob(content, "ja_jp", fileName);
  const completed = await service.startJob(job.id);
  if (completed.status !== "completed") {
    const chunkErrors = completed.chunks
      .map((chunk) => chunk.error)
      .filter((error): error is string => Boolean(error));
    throw new Error(`Translation failed for ${fileName}: ${chunkErrors.join(" | ") || completed.error || "unknown error"}`);
  }
  return service.getCombinedTranslatedContent(job.id);
}

function assertSameStringKeys(source: Record<string, string>, translated: Record<string, string>, label: string): void {
  const sourceKeys = Object.keys(source);
  const translatedKeys = Object.keys(translated);
  const missing = sourceKeys.filter((key) => !Object.prototype.hasOwnProperty.call(translated, key));
  const extra = translatedKeys.filter((key) => !Object.prototype.hasOwnProperty.call(source, key));
  const invalid = sourceKeys.filter((key) => typeof translated[key] !== "string");
  if (missing.length || extra.length || invalid.length) {
    throw new Error(`${label} schema mismatch (missing: ${missing.join(", ")}; extra: ${extra.join(", ")}; non-string: ${invalid.join(", ")})`);
  }
}

const modSourcePath = join(instanceRoot, "kubejs", "assets", "compactmachines", "lang", "en_us.json");
const modOutputPath = join(outputRoot, "kubejs", "assets", "compactmachines", "lang", "ja_jp.json");
const questSourcePath = join(instanceRoot, "config", "ftbquests", "quests", "lang", "en_us", "chapter_group.snbt");
const questOutputPath = join(outputRoot, "config", "ftbquests", "quests", "lang", "ja_jp", "chapter_group.snbt");

const modSource = JSON.parse(await readFile(modSourcePath, "utf8")) as Record<string, string>;
if (Object.values(modSource).some((value) => typeof value !== "string")) {
  throw new Error(`Unexpected non-string value in ${modSourcePath}`);
}
const modTranslation = await translate(modSource, modSourcePath);
assertSameStringKeys(modSource, modTranslation, "Mod language");

const questSource = await readFile(questSourcePath, "utf8");
const questBundle = extractQuestText(questSource);
if (Object.keys(questBundle.content).length === 0) {
  throw new Error(`No visible quest text found in ${questSourcePath}`);
}
const questTranslation = await translate(questBundle.content, questSourcePath);
assertSameStringKeys(questBundle.content, questTranslation, "Quest language");
const questOutput = applyQuestTranslations(questSource, questBundle, questTranslation);

await mkdir(join(outputRoot, "kubejs", "assets", "compactmachines", "lang"), { recursive: true });
await mkdir(join(outputRoot, "config", "ftbquests", "quests", "lang", "ja_jp"), { recursive: true });
await writeFile(modOutputPath, JSON.stringify({ ...modSource, ...modTranslation }, null, 2) + "\n", "utf8");
await writeFile(questOutputPath, questOutput, "utf8");

const questRoundTrip = extractQuestText(questOutput);
if (Object.keys(questRoundTrip.content).length !== Object.keys(questBundle.content).length) {
  throw new Error("Quest output changed the number of visible text spans.");
}

console.log(JSON.stringify({
  provider,
  model,
  outputRoot,
  mod: {
    source: modSourcePath,
    output: modOutputPath,
    entries: Object.keys(modSource).length,
    sample: Object.fromEntries(Object.keys(modSource).slice(0, 2).map((key) => [key, modTranslation[key]]))
  },
  quests: {
    source: questSourcePath,
    output: questOutputPath,
    entries: Object.keys(questBundle.content).length,
    structurePreserved: questOutput.replace(/"[^"]*"/g, "") === questSource.replace(/"[^"]*"/g, ""),
    sample: Object.fromEntries(Object.keys(questBundle.content).slice(0, 2).map((key) => [key, questTranslation[key]]))
  }
}, null, 2));
