import { access, link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { TranslationService } from "../src/lib/services/translation-service";
import { applyQuestTranslations, extractQuestText, getQuestOutputPath } from "../src/lib/services/quest-text";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "../src/lib/types/llm";

const instanceRoot = process.env.MML_ATM10_ROOT;
if (!instanceRoot) throw new Error("MML_ATM10_ROOT must point to the ATM10 SKY minecraft directory.");

const apiKey = process.env.MML_API_KEY || process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY or MML_API_KEY is required.");

const model = process.env.MML_MODEL || "gpt-6-luna";
if (model !== "gpt-6-luna") throw new Error("ATM10 quest repair is pinned to gpt-6-luna.");

const chunkSize = Number.parseInt(process.env.MML_QUEST_CHUNK_SIZE || "100", 10);
if (!Number.isInteger(chunkSize) || chunkSize < 1) throw new Error("MML_QUEST_CHUNK_SIZE must be a positive integer.");

const questsRoot = join(instanceRoot, "config", "ftbquests", "quests");
const sourcePaths = (process.env.MML_QUEST_FILES
  ? process.env.MML_QUEST_FILES.split(";").map((value) => value.trim()).filter(Boolean)
  : [
      join(questsRoot, "lang", "en_us", "chapters", "mekanism.snbt"),
      join(questsRoot, "lang", "en_us", "chapters", "mekanism_reactors.snbt"),
      join(questsRoot, "lang", "en_us.snbt"),
    ]);

const apiUsageLogs: string[] = [];
const apiErrors: string[] = [];
const redactSecret = (message: string) => message
  .replace(/\bsk-[A-Za-z0-9_-]+/g, "[REDACTED]")
  .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");

// Reuse the app's Tauri-backed service outside the desktop UI without persisting credentials.
if (typeof window === "undefined") {
  (globalThis as unknown as {
    window: { __TAURI_INTERNALS__: { invoke: (command: string, args?: { message?: string }) => Promise<undefined> } };
  }).window = {
    __TAURI_INTERNALS__: {
      invoke: async (command, args) => {
        if (command === "log_api_request" && args?.message?.includes("(tokens: input=")) {
          apiUsageLogs.push(args.message);
        }
        if (command === "log_error" && args?.message) apiErrors.push(redactSecret(args.message));
        return undefined;
      },
    },
  };
}

const service = new TranslationService({
  llmConfig: {
    provider: "openai",
    apiKey,
    model,
    maxRetries: 0,
    temperature: 0.2,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPrompt: DEFAULT_USER_PROMPT,
  },
  chunkSize,
  maxRetries: 0,
});

function maskExtractedText(source: string, spans: Array<{ start: number; end: number }>): string {
  return [...spans]
    .sort((left, right) => right.start - left.start)
    .reduce((result, span) => result.slice(0, span.start) + "<TRANSLATED_TEXT>" + result.slice(span.end), source);
}

async function assertOutputIsMissing(outputPath: string): Promise<void> {
  try {
    await access(outputPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Refusing to spend tokens or overwrite an existing locale file: ${outputPath}`);
}

const summaries = [];
for (const sourcePath of sourcePaths) {
  const source = await readFile(sourcePath, "utf8");
  const bundle = extractQuestText(source);
  const entryCount = Object.keys(bundle.content).length;
  if (entryCount === 0) throw new Error(`No translatable FTB quest text found: ${sourcePath}`);

  const outputPath = getQuestOutputPath(sourcePath, "ja_jp");
  if (outputPath === sourcePath) throw new Error(`Refusing to overwrite an inline quest source: ${sourcePath}`);
  await assertOutputIsMissing(outputPath);

  const job = service.createJob(bundle.content, "ja_jp", sourcePath);
  const completed = await service.startJob(job.id);
  if (completed.status !== "completed") {
    const failures = completed.chunks
      .map((chunk) => chunk.error)
      .filter((message): message is string => Boolean(message));
    throw new Error(redactSecret(`Quest repair failed for ${sourcePath}: ${failures.join(" | ") || completed.error || completed.status}`));
  }

  const translated = service.getCombinedTranslatedContent(job.id);
  const result = applyQuestTranslations(source, bundle, translated);
  const resultBundle = extractQuestText(result);
  if (resultBundle.spans.length !== bundle.spans.length
      || maskExtractedText(source, bundle.spans) !== maskExtractedText(result, resultBundle.spans)) {
    throw new Error(`Quest SNBT structure changed while translating: ${sourcePath}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  const tempPath = join(dirname(outputPath), `.${basename(outputPath)}.mml-${process.pid}-${Date.now()}.tmp`);
  await writeFile(tempPath, result, { encoding: "utf8", flag: "wx" });
  try {
    // A hard link installs atomically and fails if another process created the locale file.
    await link(tempPath, outputPath);
  } catch (error) {
    throw new Error(`Could not install validated quest output ${outputPath}; staged file retained at ${tempPath}: ${String(error)}`);
  }
  await unlink(tempPath).catch((error) => {
    console.warn(`Validated output is installed; temporary hard link could not be removed: ${tempPath} (${String(error)})`);
  });

  summaries.push({
    source: sourcePath,
    output: outputPath,
    translatedEntries: entryCount,
    chunks: job.chunks.length,
    structuralMatch: true,
  });
}

console.log(JSON.stringify({ provider: "openai", model, chunkSize, summaries, apiUsageLogs, apiErrorCount: apiErrors.length }, null, 2));
