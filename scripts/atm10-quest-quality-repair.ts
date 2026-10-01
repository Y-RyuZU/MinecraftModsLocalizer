import { copyFile, access, link, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, join } from "node:path";
import { TranslationService } from "../src/lib/services/translation-service";
import {
  applyQuestTranslations,
  extractQuestText,
  getQuestOutputPath,
  getUntranslatedEnglishQuestKeys,
} from "../src/lib/services/quest-text";
import { DEFAULT_CHUNK_SIZE } from "../src/lib/types/config";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "../src/lib/types/llm";

const instanceRoot = process.env.MML_ATM10_ROOT;
if (!instanceRoot) throw new Error("MML_ATM10_ROOT must point to the ATM10 SKY minecraft directory.");
const apiKey = process.env.MML_API_KEY || process.env.OPENAI_API_KEY;
if (!apiKey && process.env.MML_DRY_RUN !== "1") throw new Error("OPENAI_API_KEY or MML_API_KEY is required.");
const model = process.env.MML_MODEL || "gpt-6-luna";
if (model !== "gpt-6-luna") throw new Error("ATM10 quest quality repair is pinned to gpt-6-luna.");

const chunkSize = Number.parseInt(process.env.MML_QUEST_CHUNK_SIZE || String(DEFAULT_CHUNK_SIZE), 10);
if (!Number.isInteger(chunkSize) || chunkSize < 1) throw new Error("MML_QUEST_CHUNK_SIZE must be a positive integer.");
const questsRoot = join(instanceRoot, "config", "ftbquests", "quests");
const localeRoot = join(questsRoot, "lang", "en_us");
const defaultSources = [
  join(localeRoot, "chapters", "mekanism.snbt"),
  join(localeRoot, "chapters", "mekanism_reactors.snbt"),
  join(questsRoot, "lang", "en_us.snbt"),
];

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function getSourcePaths(): Promise<string[]> {
  if (process.env.MML_QUEST_REPAIR_ALL !== "1") return defaultSources;
  const paths = [join(questsRoot, "lang", "en_us.snbt")];
  for await (const relativePath of new Bun.Glob("**/*.snbt").scan({ cwd: localeRoot, onlyFiles: true })) {
    paths.push(join(localeRoot, relativePath));
  }
  return [...new Set(paths)].sort();
}

function maskSpans(source: string, spans: Array<{ start: number; end: number }>): string {
  return [...spans]
    .sort((left, right) => right.start - left.start)
    .reduce((result, span) => result.slice(0, span.start) + "<TRANSLATED_TEXT>" + result.slice(span.end), source);
}

function sameKeySet(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index]);
}

function isLongEnglishProse(value: string): boolean {
  const plainText = value
    .replace(/[§&][0-9a-fk-or]/gi, " ")
    .replace(/\{(?:image|item|recipe|link):[^}]*\}/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ");
  return plainText.trim().length >= 80 && (plainText.match(/[A-Za-z]{3,}/g)?.length ?? 0) >= 10;
}

async function installValidatedOutput(outputPath: string, previous: string | null, result: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  const tempPath = join(dirname(outputPath), `.${basename(outputPath)}.mml-${process.pid}-${Date.now()}.tmp`);
  await writeFile(tempPath, result, { encoding: "utf8", flag: "wx" });

  if (previous === null) {
    try {
      await link(tempPath, outputPath);
    } catch (error) {
      throw new Error(`Could not install validated quest output ${outputPath}; staged file retained at ${tempPath}: ${String(error)}`);
    }
  } else {
    const backupPath = `${outputPath}.mml-before-quality-repair.bak`;
    try {
      await copyFile(outputPath, backupPath, constants.COPYFILE_EXCL);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    try {
      if (await readFile(outputPath, "utf8") !== previous) {
        throw new Error(`Quest locale changed during translation; refusing to overwrite ${outputPath}`);
      }
      await rename(tempPath, outputPath);
    } catch (error) {
      throw new Error(`Could not atomically update ${outputPath}; backup is ${backupPath}, staged file retained at ${tempPath}: ${String(error)}`);
    }
  }

  await unlink(tempPath).catch((error) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`Validated output is installed; temporary link could not be removed: ${tempPath} (${String(error)})`);
    }
  });
}

const apiUsageLogs: string[] = [];
const redactSecret = (message: string) => message
  .replace(/\bsk-[A-Za-z0-9_-]+/g, "[REDACTED]")
  .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");

if (typeof window === "undefined") {
  (globalThis as unknown as {
    window: { __TAURI_INTERNALS__: { invoke: (command: string, args?: { message?: string }) => Promise<undefined> } };
  }).window = {
    __TAURI_INTERNALS__: {
      invoke: async (command, args) => {
        if (command === "log_api_request" && args?.message?.includes("(tokens: input=")) apiUsageLogs.push(args.message);
        return undefined;
      },
    },
  };
}

const filter = (process.env.MML_QUEST_REPAIR_FILTER || "").toLowerCase();
const failures: Array<{ source: string; error: string }> = [];
const files: Array<{
  sourcePath: string;
  outputPath: string;
  source: string;
  previous: string | null;
  workingText: string;
  sourceBundle: ReturnType<typeof extractQuestText>;
  workingBundle: ReturnType<typeof extractQuestText>;
  localToJobKey: Record<string, string>;
}> = [];
const jobContent: Record<string, string> = {};
const summaries = [];
const langRoot = join(instanceRoot, "config", "ftbquests", "quests", "lang");

for (const sourcePath of await getSourcePaths()) {
  if (filter && !sourcePath.toLowerCase().includes(filter)) continue;
  const source = await readFile(sourcePath, "utf8");
  const sourceBundle = extractQuestText(source);
  if (sourceBundle.spans.length === 0) continue;

  const outputPath = getQuestOutputPath(sourcePath, "ja_jp");
  const previous = await exists(outputPath) ? await readFile(outputPath, "utf8") : null;
  const workingText = previous ?? source;
  const workingBundle = previous === null ? sourceBundle : extractQuestText(previous);
  if (!sameKeySet(sourceBundle.content, workingBundle.content)) {
    failures.push({ source: sourcePath, error: "Source and ja_jp files have different quest text keys; left unchanged." });
    continue;
  }

  const keysToTranslate = previous === null
    ? Object.keys(sourceBundle.content)
    : getUntranslatedEnglishQuestKeys(sourceBundle, workingBundle)
      .filter((key) => isLongEnglishProse(workingBundle.content[key]));
  if (keysToTranslate.length === 0) {
    summaries.push({ source: sourcePath, output: outputPath, status: "already complete", keys: 0 });
    continue;
  }

  const localToJobKey: Record<string, string> = {};
  for (const key of keysToTranslate) {
    const relativeSourcePath = sourcePath.slice(langRoot.length + 1).replaceAll("\\", "/");
    const jobKey = `${relativeSourcePath}::${key}`;
    localToJobKey[key] = jobKey;
    jobContent[jobKey] = sourceBundle.content[key];
  }
  files.push({ sourcePath, outputPath, source, previous, workingText, sourceBundle, workingBundle, localToJobKey });
}

if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exit(1);
}

if (process.env.MML_DRY_RUN === "1" || Object.keys(jobContent).length === 0) {
  const alreadyCompleteCount = summaries.length;
  console.log(JSON.stringify({
    mode: process.env.MML_DRY_RUN === "1" ? "dry-run" : "already-complete",
    provider: "openai",
    model,
    chunkSize,
    batchChunks: Math.ceil(Object.keys(jobContent).length / chunkSize),
    candidateEntries: Object.keys(jobContent).length,
    filesToRepair: files.length,
    alreadyCompleteFiles: alreadyCompleteCount,
    files: files.map(({ sourcePath, outputPath, previous, localToJobKey }) => ({
      source: sourcePath,
      output: outputPath,
      operation: previous === null ? "create" : "repair",
      entries: Object.keys(localToJobKey).length,
    })),
  }, null, 2));
  process.exit(0);
}

if (!apiKey) throw new Error("OPENAI_API_KEY or MML_API_KEY is required.");
const service = new TranslationService({
  llmConfig: {
    provider: "openai",
    apiKey,
    model,
    maxRetries: 0,
    temperature: 0.2,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPrompt: DEFAULT_USER_PROMPT,
    useBatchApi: true,
  },
  chunkSize,
  maxRetries: 0,
});

const job = service.createJob(jobContent, "ja_jp", "ATM10 SKY quest quality repair");
console.log(`Submitting ${Object.keys(jobContent).length} quest values in ${job.chunks.length} OpenAI Batch request(s) (chunk size ${chunkSize}).`);
const responses = await service.translateChunksBatch(
  job.chunks.map((chunk) => ({ content: chunk.content, targetLanguage: "ja_jp", jobId: job.id })),
  ({ completed, total, status }) => console.log(`OpenAI Batch ${status}: ${completed}/${total} requests`),
);
if (responses.length !== job.chunks.length) {
  throw new Error(`Batch returned ${responses.length} results for ${job.chunks.length} chunks.`);
}
for (let index = 0; index < responses.length; index++) {
  const response = responses[index];
  if (!response?.translatedContent) {
    throw new Error(redactSecret(response?.error || `Batch chunk ${index + 1} failed.`));
  }
  job.chunks[index].translatedContent = response.translatedContent;
  job.chunks[index].status = "completed";
}
job.status = "completed";
const translated = service.getCombinedTranslatedContent(job.id);
if (!sameKeySet(jobContent, translated)) throw new Error("Batch output keys did not match the complete input key set.");

const staged: Array<{ file: (typeof files)[number]; content: string }> = [];
for (const file of files) {
  const merged = { ...file.workingBundle.content };
  for (const [localKey, jobKey] of Object.entries(file.localToJobKey)) {
    merged[localKey] = translated[jobKey];
  }
  const result = applyQuestTranslations(file.workingText, file.workingBundle, merged);
  const resultBundle = extractQuestText(result);
  if (!sameKeySet(file.workingBundle.content, resultBundle.content)
      || maskSpans(file.workingText, file.workingBundle.spans) !== maskSpans(result, resultBundle.spans)) {
    throw new Error(`Quest SNBT structure changed while repairing ${file.sourcePath}`);
  }
  if (await readFile(file.sourcePath, "utf8") !== file.source) {
    throw new Error(`Quest source changed during translation; refusing to write ${file.outputPath}`);
  }
  staged.push({ file, content: result });
}

for (const { file, content } of staged) {
  await installValidatedOutput(file.outputPath, file.previous, content);
  summaries.push({
    source: file.sourcePath,
    output: file.outputPath,
    status: file.previous === null ? "created" : "repaired",
    keys: Object.keys(file.localToJobKey).length,
  });
  console.log(JSON.stringify(summaries.at(-1)));
}

console.log(JSON.stringify({
  provider: "openai",
  model,
  chunkSize,
  batchChunks: job.chunks.length,
  candidateEntries: Object.keys(jobContent).length,
  alreadyCompleteFiles: summaries.filter(({ status }) => status === "already complete").length,
  summaries,
  apiUsageLogs,
}, null, 2));
