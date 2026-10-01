import JSZip from "jszip";
import { constants } from "node:fs";
import { access, copyFile, link, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { TranslationService } from "../src/lib/services/translation-service";
import { getUntranslatedLanguageEntries } from "../src/lib/services/mod-language";
import {
  applyQuestTranslations,
  extractJsonLangText,
  extractQuestText,
  getQuestOutputPath,
  getQuestSourceCacheKey,
  getUntranslatedEnglishQuestKeys,
} from "../src/lib/services/quest-text";
import { DEFAULT_CHUNK_SIZE } from "../src/lib/types/config";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "../src/lib/types/llm";

const instanceRoot = process.env.MML_ATM10_ROOT;
const apiKey = process.env.OPENAI_API_KEY || process.env.MML_API_KEY;
const model = process.env.MML_MODEL || "gpt-6-luna";
if (!instanceRoot) throw new Error("MML_ATM10_ROOT must point to the ATM10 SKY minecraft directory.");
if (!apiKey && process.env.MML_DRY_RUN !== "1") throw new Error("OPENAI_API_KEY or MML_API_KEY is required.");
if (model !== "gpt-6-luna") throw new Error("ATM10 repair is pinned to gpt-6-luna.");

const instanceDir = dirname(instanceRoot);
const instanceConfig = await readFile(join(instanceDir, "instance.cfg"), "utf8");
if (!instanceConfig.includes("ManagedPackName=ATM10SKY") || !instanceConfig.includes("ManagedPackVersionName=2.0.6")) {
  throw new Error("The selected Prism instance is not the expected ATM10 SKY 2.0.6 instance.");
}

const resourcePack = join(instanceRoot, "resourcepacks", "MML-ATM10SKY-GPT6Luna");
const questRoot = join(instanceRoot, "config", "ftbquests", "quests");
const forcedModNamespaces = new Set(
  (process.env.MML_FORCE_MOD_NAMESPACES || "")
    .split(",")
    .map((namespace) => namespace.trim().toLowerCase())
    .filter(Boolean)
);
const mergePartialLocales = process.env.MML_MERGE_PARTIAL_LOCALES === "1";
const apiUsageLogs: string[] = [];
const apiErrors: string[] = [];

if (typeof window === "undefined") {
  (globalThis as unknown as {
    window: { __TAURI_INTERNALS__: { invoke: (command: string, args?: { message?: string }) => Promise<undefined> } };
  }).window = {
    __TAURI_INTERNALS__: {
      invoke: async (command, args) => {
        if (command === "log_api_request" && args?.message) apiUsageLogs.push(args.message);
        if (command === "log_error" && args?.message) apiErrors.push(redactSecret(args.message));
        return undefined;
      },
    },
  };
}

function redactSecret(message: string): string {
  return message.replace(/\bsk-[A-Za-z0-9_-]+/g, "[REDACTED]").replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function walkSnbt(root: string): Promise<string[]> {
  const files: string[] = [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return files;
    throw error;
  }
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await walkSnbt(path));
    else if (/\.snbt(?:_merged)?$/i.test(entry.name)) files.push(path);
  }
  return files;
}

function addUniqueTranslation(
  cacheKey: string,
  sourceText: string,
  requestKey: string,
  entries: Record<string, string>,
  entryByCacheKey: Map<string, string>
): string {
  const existing = entryByCacheKey.get(cacheKey);
  if (existing) return existing;
  if (Object.prototype.hasOwnProperty.call(entries, requestKey)) throw new Error(`Duplicate translation request key: ${requestKey}`);
  entries[requestKey] = sourceText;
  entryByCacheKey.set(cacheKey, requestKey);
  return requestKey;
}

function sameKeySet(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index]);
}

function maskSpans(source: string, spans: Array<{ start: number; end: number }>): string {
  return [...spans]
    .sort((left, right) => right.start - left.start)
    .reduce((result, span) => result.slice(0, span.start) + "<TRANSLATED_TEXT>" + result.slice(span.end), source);
}

async function installNewFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = join(dirname(path), `.${basename(path)}.mml-${process.pid}-${Date.now()}.tmp`);
  await writeFile(tempPath, content, { encoding: "utf8", flag: "wx" });
  try {
    await link(tempPath, path);
  } catch (error) {
    throw new Error(`Could not install ${path}; staged output retained at ${tempPath}: ${String(error)}`);
  }
  await unlink(tempPath).catch(() => undefined);
}

async function installModOutput(path: string, previous: string | null, content: string): Promise<void> {
  if (previous === null) return installNewFile(path, content);

  await mkdir(dirname(path), { recursive: true });
  const tempPath = join(dirname(path), `.${basename(path)}.mml-${process.pid}-${Date.now()}.tmp`);
  const backupPath = `${path}.mml-before-force.bak`;
  await writeFile(tempPath, content, { encoding: "utf8", flag: "wx" });
  try {
    await copyFile(path, backupPath, constants.COPYFILE_EXCL);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (await readFile(path, "utf8") !== previous) {
    throw new Error(`Mod locale changed during translation; refusing to overwrite ${path}`);
  }
  try {
    await rename(tempPath, path);
  } catch (error) {
    throw new Error(`Could not atomically update ${path}; backup is ${backupPath}, staged output retained at ${tempPath}: ${String(error)}`);
  }
}

async function installQuestOutput(path: string, previous: string | null, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = join(dirname(path), `.${basename(path)}.mml-${process.pid}-${Date.now()}.tmp`);
  await writeFile(tempPath, content, { encoding: "utf8", flag: "wx" });
  if (previous === null) {
    try {
      await link(tempPath, path);
    } catch (error) {
      throw new Error(`Could not install ${path}; staged output retained at ${tempPath}: ${String(error)}`);
    }
  } else {
    const backupPath = `${path}.mml-before-quality-repair.bak`;
    try {
      await copyFile(path, backupPath, constants.COPYFILE_EXCL);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    if (await readFile(path, "utf8") !== previous) {
      throw new Error(`Quest locale changed during translation; refusing to overwrite ${path}`);
    }
    try {
      await rename(tempPath, path);
    } catch (error) {
      throw new Error(`Could not atomically update ${path}; backup is ${backupPath}, staged output retained at ${tempPath}: ${String(error)}`);
    }
  }
  await unlink(tempPath).catch(() => undefined);
}

function parseLanguageObject(raw: string, extension: "json" | "lang"): Record<string, unknown> {
  if (extension === "json") {
    const parsed: unknown = JSON.parse(raw.replace(/^\uFEFF/, ""));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Language JSON must be an object.");
    return parsed as Record<string, unknown>;
  }
  return Object.fromEntries(raw.split(/\r?\n/).flatMap((line) => {
    const property = line.match(/^\s*([^#!\s][^=:\s]*)\s*[=:]\s*(.*)$/);
    return property ? [[property[1], property[2]]] : [];
  }));
}

type ModGroup = {
  namespace: string;
  extension: "json" | "lang";
  content: Record<string, string>;
  sourceContent: Record<string, string>;
  baseContent: Record<string, unknown>;
};
const modGroups = new Map<string, ModGroup>();
for (const fileName of await readdir(join(instanceRoot, "mods"))) {
  if (!fileName.toLowerCase().endsWith(".jar")) continue;
  const jar = await JSZip.loadAsync(await readFile(join(instanceRoot, "mods", fileName)));
  const names = Object.keys(jar.files).filter((name) => !jar.files[name].dir);
  const inJarJa = new Map<string, Record<string, unknown>>();
  for (const name of names) {
    const match = name.match(/(?:^|\/)assets\/([^/]+)\/lang\/ja_jp\.(json|lang)$/i);
    if (!match) continue;
    const [, namespace, rawExtension] = match;
    const extension = rawExtension.toLowerCase() as "json" | "lang";
    const key = `${namespace.toLowerCase()}|${extension}`;
    const values = parseLanguageObject(await jar.file(name)!.async("string"), extension);
    const existing = inJarJa.get(key) ?? {};
    Object.assign(existing, values);
    inJarJa.set(key, existing);
  }
  for (const name of names) {
    const match = name.match(/(?:^|\/)assets\/([^/]+)\/lang\/en_us\.(json|lang)$/i);
    if (!match) continue;
    const [, namespace, rawExtension] = match;
    const extension = rawExtension.toLowerCase() as "json" | "lang";
    const key = `${namespace.toLowerCase()}|${extension}`;
    const outputPath = join(resourcePack, "assets", namespace, "lang", `ja_jp.${extension}`);
    const forceNamespace = forcedModNamespaces.has(namespace.toLowerCase());
    const hasResourcePackLocale = await exists(outputPath);
    if (!forceNamespace && hasResourcePackLocale) continue;
    let content: Record<string, string>;
    const raw = await jar.file(name)!.async("string");
    if (extension === "json") content = extractJsonLangText(raw);
    else content = parseLanguageObject(raw, extension) as Record<string, string>;

    const baseContent = inJarJa.get(key) ?? {};
    if (!forceNamespace && inJarJa.has(key) && !mergePartialLocales) continue;
    const pending = forceNamespace || !mergePartialLocales
      ? content
      : getUntranslatedLanguageEntries(content, baseContent);
    if (Object.keys(pending).length === 0) continue;

    const group = modGroups.get(key) ?? { namespace, extension, content: {}, sourceContent: {}, baseContent: {} };
    Object.assign(group.content, pending);
    Object.assign(group.sourceContent, content);
    Object.assign(group.baseContent, baseContent);
    modGroups.set(key, group);
  }
}

const foundGroups = [...modGroups.keys()].sort();
const unexpectedMissingGroups = foundGroups.filter((key) => !forcedModNamespaces.has(key.split("|")[0].toLowerCase()));
const foundForcedNamespaces = new Set(foundGroups.map((key) => key.split("|")[0].toLowerCase()));
const missingForcedNamespaces = [...forcedModNamespaces].filter((namespace) => !foundForcedNamespaces.has(namespace));
if ((!mergePartialLocales && unexpectedMissingGroups.length) || missingForcedNamespaces.length) {
  throw new Error(`Unexpected mod groups: [${unexpectedMissingGroups.join(", ")}]; forced namespaces not found: [${missingForcedNamespaces.join(", ")}]. Re-audit before spending API credits.`);
}
if (mergePartialLocales && [...modGroups.values()].some((group) => group.extension !== "json")) {
  throw new Error("Partial-locale merge currently expects JSON resources; use the app writer for legacy .lang files.");
}
if (!(await exists(join(resourcePack, "pack.mcmeta")))) throw new Error(`Existing translated resource pack is missing: ${resourcePack}`);

type QuestFile = {
  sourcePath: string;
  outputPath: string;
  source: string;
  previous: string | null;
  workingText: string;
  sourceBundle: ReturnType<typeof extractQuestText>;
  workingBundle: ReturnType<typeof extractQuestText>;
  localToJobKey: Record<string, string>;
};
const questFiles: QuestFile[] = [];
const questContent: Record<string, string> = {};
const entryByCacheKey = new Map<string, string>();
const modJobKeys = new Map<string, Record<string, string>>();

for (const [groupKey, group] of modGroups) {
  const keyMap: Record<string, string> = {};
  for (const [sourceKey, text] of Object.entries(group.content)) {
    keyMap[sourceKey] = addUniqueTranslation(
      `mod\0${groupKey}\0${sourceKey}`,
      text,
      `${group.namespace}|${group.extension}|${sourceKey}`,
      questContent,
      entryByCacheKey
    );
  }
  modJobKeys.set(groupKey, keyMap);
}

const langRoot = join(questRoot, "lang");
const questSources = [
  ...(await walkSnbt(join(langRoot, "en_us"))),
  join(langRoot, "en_us.snbt"),
  join(langRoot, "en_us.snbt_merged"),
].sort();
for (const sourcePath of [...new Set(questSources)]) {
  let source: string;
  try {
    source = await readFile(sourcePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
    throw error;
  }
  const sourceBundle = extractQuestText(source);
  if (sourceBundle.spans.length === 0) continue;
  const outputPath = getQuestOutputPath(sourcePath, "ja_jp");
  const previous = await exists(outputPath) ? await readFile(outputPath, "utf8") : null;
  const workingText = previous ?? source;
  const workingBundle = previous === null ? sourceBundle : extractQuestText(previous);
  if (previous !== null && !sameKeySet(sourceBundle.content, workingBundle.content)) {
    throw new Error(`Source and ja_jp files have different quest text keys; refusing to repair ${outputPath}`);
  }
  const keysToTranslate = previous === null
    ? Object.keys(sourceBundle.content)
    : getUntranslatedEnglishQuestKeys(sourceBundle, workingBundle);
  if (keysToTranslate.length === 0) continue;
  const spanByKey = new Map(sourceBundle.spans.map((span) => [span.key, span]));
  const localToJobKey: Record<string, string> = {};
  for (const key of keysToTranslate) {
    const cacheKey = getQuestSourceCacheKey(sourcePath, key, sourceBundle.content[key], spanByKey.get(key)?.sourceKey);
    const relativeSourcePath = sourcePath.slice(langRoot.length + 1).replaceAll("\\", "/");
    localToJobKey[key] = addUniqueTranslation(
      `quest\0${cacheKey}`,
      sourceBundle.content[key],
      `${relativeSourcePath}::${key}`,
      questContent,
      entryByCacheKey
    );
  }
  questFiles.push({ sourcePath, outputPath, source, previous, workingText, sourceBundle, workingBundle, localToJobKey });
}

if (process.env.MML_DRY_RUN === "1") {
  console.log(JSON.stringify({
    mode: "dry-run",
    status: Object.keys(questContent).length === 0 ? "no-work" : "pending-work",
    instance: instanceRoot,
    provider: "openai",
    model,
    chunkSize: DEFAULT_CHUNK_SIZE,
    batchChunks: Math.ceil(Object.keys(questContent).length / DEFAULT_CHUNK_SIZE),
    translatedEntries: Object.keys(questContent).length,
    sourceCharacters: Object.values(questContent).reduce((count, text) => count + text.length, 0),
    mergePartialLocales,
    forcedModNamespaces: [...forcedModNamespaces],
    modGroups: Object.fromEntries([...modGroups].map(([key, group]) => [key, Object.keys(group.content).length])),
    questFilesToCreate: questFiles.filter(({ previous }) => previous === null).length,
    questFilesToRepair: questFiles.filter(({ previous }) => previous !== null).length,
    existingQuestKeysToRepair: questFiles.filter(({ previous }) => previous !== null)
      .reduce((count, file) => count + Object.keys(file.localToJobKey).length, 0),
    questOutputSample: questFiles.slice(0, 5).map(({ outputPath, previous }) => ({
      output: outputPath,
      operation: previous === null ? "create" : "repair",
    })),
  }, null, 2));
  process.exit(0);
}

if (Object.keys(questContent).length === 0) {
  throw new Error("No missing ATM10 mod strings or FTB quest translations were found; nothing was submitted.");
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
  chunkSize: DEFAULT_CHUNK_SIZE,
  maxRetries: 1,
  currentFileName: "ATM10 SKY full repair",
});
const job = service.createJob(questContent, "ja_jp", "ATM10 SKY mods and quests");
const responses = await service.translateChunksBatch(
  job.chunks.map((chunk) => ({ content: chunk.content, targetLanguage: "ja_jp", jobId: job.id })),
  ({ completed, total, status }) => console.log(`Batch ${status}: ${completed}/${total} chunks`)
);
for (let index = 0; index < job.chunks.length; index++) {
  const response = responses[index];
  if (!response?.translatedContent) throw new Error(redactSecret(response?.error || `Batch chunk ${index + 1} failed`));
  job.chunks[index].translatedContent = response.translatedContent;
  job.chunks[index].status = "completed";
}
job.status = "completed";
const translated = service.getCombinedTranslatedContent(job.id);
if (!sameKeySet(questContent, translated)) throw new Error("Batch output key set did not match the complete input key set.");

const stagedMods: Array<{ path: string; previous: string | null; content: string }> = [];
for (const [groupKey, group] of modGroups) {
  const keyMap = modJobKeys.get(groupKey)!;
  const localized = Object.fromEntries(Object.entries(keyMap).map(([sourceKey, jobKey]) => [sourceKey, translated[jobKey]]));
  if (!sameKeySet(group.content, localized)) throw new Error(`Invalid translated key set for ${groupKey}`);
  const mergedLocale = mergePartialLocales && !forcedModNamespaces.has(group.namespace.toLowerCase())
    ? { ...group.baseContent, ...localized }
    : localized;
  const missingSourceKeys = Object.keys(group.sourceContent).filter((key) => typeof mergedLocale[key] !== "string");
  if (missingSourceKeys.length) throw new Error(`Incomplete merged locale for ${groupKey}: ${missingSourceKeys.slice(0, 10).join(", ")}`);
  const path = join(resourcePack, "assets", group.namespace, "lang", `ja_jp.${group.extension}`);
  const previous = await exists(path) ? await readFile(path, "utf8") : null;
  if (previous !== null && !forcedModNamespaces.has(group.namespace.toLowerCase())) {
    throw new Error(`A locale output appeared during translation; refusing to overwrite ${path}`);
  }
  stagedMods.push({ path, previous, content: JSON.stringify(mergedLocale, null, 2) + "\n" });
}

const stagedQuests: Array<{ file: QuestFile; content: string }> = [];
for (const file of questFiles) {
  if (await readFile(file.sourcePath, "utf8") !== file.source) throw new Error(`Quest source changed during translation: ${file.sourcePath}`);
  if (file.previous === null && await exists(file.outputPath)) throw new Error(`Quest locale appeared during translation; refusing to overwrite ${file.outputPath}`);
  if (file.previous !== null && await readFile(file.outputPath, "utf8") !== file.previous) throw new Error(`Quest locale changed during translation; refusing to overwrite ${file.outputPath}`);
  const merged = { ...file.workingBundle.content };
  for (const [localKey, jobKey] of Object.entries(file.localToJobKey)) merged[localKey] = translated[jobKey];
  const result = applyQuestTranslations(file.workingText, file.workingBundle, merged);
  const resultBundle = extractQuestText(result);
  if (!sameKeySet(file.workingBundle.content, resultBundle.content)
      || maskSpans(file.workingText, file.workingBundle.spans) !== maskSpans(result, resultBundle.spans)) {
    throw new Error(`Quest SNBT structure changed while translating ${file.sourcePath}`);
  }
  stagedQuests.push({ file, content: result });
}

for (const output of stagedMods) await installModOutput(output.path, output.previous, output.content);
for (const output of stagedQuests) await installQuestOutput(output.file.outputPath, output.file.previous, output.content);

console.log(JSON.stringify({
  provider: "openai",
  model,
  chunkSize: DEFAULT_CHUNK_SIZE,
  batchChunks: job.chunks.length,
  mergePartialLocales,
  forcedModNamespaces: [...forcedModNamespaces],
  translatedEntries: Object.keys(questContent).length,
  modFilesAdded: stagedMods.map(({ path }) => path),
  questFilesCreated: stagedQuests.filter(({ file }) => file.previous === null).map(({ file }) => file.outputPath),
  questFilesRepaired: stagedQuests.filter(({ file }) => file.previous !== null).map(({ file }) => file.outputPath),
  questKeysRepaired: stagedQuests.filter(({ file }) => file.previous !== null)
    .reduce((count, { file }) => count + Object.keys(file.localToJobKey).length, 0),
  apiUsageLogs,
  apiErrorCount: apiErrors.length,
}, null, 2));
