import { isRetranslationRequested } from "./translation-policy";

export interface QuestTextSpan {
  key: string;
  start: number;
  end: number;
  /** Stable FTB localization field, used to reuse identical strings across legacy/split files. */
  sourceKey?: string;
}

export interface QuestTextBundle {
  content: Record<string, string>;
  spans: QuestTextSpan[];
}

/** Find long, untranslated English prose without flagging short item or mod names. */
export function getUntranslatedEnglishQuestKeys(
  source: QuestTextBundle,
  localized: QuestTextBundle
): string[] {
  return Object.keys(source.content).filter((key) => {
    const value = localized.content[key];
    if (typeof value !== "string" || /[\u3040-\u30ff\u3400-\u9fff]/.test(value)) return false;
    const prose = value
      .replace(/[§&][0-9a-fk-or]/gi, " ")
      .replace(/\{(?:image|item|recipe|link):[^}]*\}/gi, " ")
      .replace(/https?:\/\/\S+/gi, " ")
      .trim();
    return prose.length >= 80 && (prose.match(/[A-Za-z]{3,}/g)?.length ?? 0) >= 10;
  });
}

export function getQuestSourceCacheKey(targetPath: string, key: string, sourceText: string, sourceKey?: string): string {
  return sourceKey ? `${sourceKey}\0${sourceText}` : `${targetPath}\0${key}`;
}

/** Map locale sources to sibling outputs; legacy embedded formats intentionally replace the source. */
export function getQuestOutputPath(sourcePath: string, targetLanguage: string): string {
  const separator = sourcePath.includes("\\") ? "\\" : "/";
  const localeFile = sourcePath.match(/^([\s\S]*[\\/])lang[\\/]en_us\.(json|lang)$/i);
  if (localeFile) return localeFile[1] + "lang" + separator + targetLanguage + "." + localeFile[2].toLowerCase();

  const flatLocalizedSnbt = sourcePath.match(/^([\s\S]*[\\/])lang[\\/]en_us(\.snbt(?:_merged)?)$/i);
  if (flatLocalizedSnbt) return flatLocalizedSnbt[1] + "lang" + separator + targetLanguage + flatLocalizedSnbt[2];

  const localizedSnbt = sourcePath.match(/^([\s\S]*[\\/])lang[\\/]en_us([\\/].*)$/i);
  if (localizedSnbt) return localizedSnbt[1] + "lang" + separator + targetLanguage + localizedSnbt[2];

  const legacyFtbFile = sourcePath.match(/^([\s\S]*[\\/])config[\\/](ftbquests|ftb_quests)[\\/]quests[\\/](.+)$/i);
  if (legacyFtbFile) {
    if (/\.snbt(?:_merged)?$/i.test(legacyFtbFile[3])) return sourcePath;
    return legacyFtbFile[1] + "config" + separator + legacyFtbFile[2] + separator + "quests" + separator + "lang" + separator + targetLanguage + separator + legacyFtbFile[3];
  }

  if (isDirectBetterQuestSource(sourcePath)) return sourcePath;
  throw new Error("Cannot determine a safe localized output path for " + sourcePath);
}

/** Older FTB quest files and BetterQuesting defaults have no locale output path. */
export function isDirectQuestSource(sourcePath: string): boolean {
  return /[\\/]config[\\/](?:ftbquests|ftb_quests)[\\/]quests[\\/](?!lang[\\/]|lang\.)[\s\S]+\.snbt(?:_merged)?$/i.test(sourcePath)
    || isDirectBetterQuestSource(sourcePath);
}

export function getDirectQuestBackupPath(sourcePath: string): string {
  return sourcePath + ".mml-original.bak";
}

function isDirectBetterQuestSource(sourcePath: string): boolean {
  return /[\\/]config[\\/]betterquesting[\\/]DefaultQuests(?:\.lang|\.json)$/i.test(sourcePath)
    || /[\\/]config[\\/]betterquesting[\\/]DefaultQuests[\\/].+\.json$/i.test(sourcePath);
}

/** Keep an existing target-language file instead of overwriting user translations. */
export async function filterExistingQuestTranslations<T extends { path: string; forceTranslationLanguage?: string }>(
  targets: T[],
  targetLanguage: string,
  fileExists: (path: string) => Promise<boolean>
): Promise<T[]> {
  const exists = await Promise.all(targets.map((target) =>
    isRetranslationRequested(target, targetLanguage) || isDirectQuestSource(target.path)
      ? false
      : fileExists(getQuestOutputPath(target.path, targetLanguage))
  ));
  return targets.filter((_, index) => !exists[index]);
}

/** Read translatable values from a flat Minecraft language JSON file. */
export function extractJsonLangText(source: string): Record<string, string> {
  const parsed: unknown = JSON.parse(source.replace(/^\uFEFF/, ""));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Language JSON must be an object");
  }
  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string" && !/^comment_\d+$/i.test(entry[0])
    )
  );
}

/** Replace only string values after verifying the translated key set is unchanged. */
export function applyJsonLangTranslations(source: string, translated: Record<string, string>): string {
  const parsed: unknown = JSON.parse(source.replace(/^\uFEFF/, ""));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Language JSON must be an object");
  }
  const original = parsed as Record<string, unknown>;
  const expectedKeys = Object.keys(original).filter((key) =>
    typeof original[key] === "string" && !/^comment_\d+$/i.test(key)
  );
  const missingKeys = expectedKeys.filter((key) => typeof translated[key] !== "string");
  const extraKeys = Object.keys(translated).filter((key) => !expectedKeys.includes(key));
  if (missingKeys.length || extraKeys.length) {
    throw new Error("Invalid JSON language translation (missing: " + missingKeys.join(", ") + "; extra: " + extraKeys.join(", ") + ")");
  }
  const result = { ...original };
  for (const key of expectedKeys) result[key] = translated[key];
  return JSON.stringify(result, null, 2) + "\n";
}

/** Read Java/Minecraft .lang properties while keeping the original value offsets. */
export function extractJavaLangText(source: string): QuestTextBundle {
  const lines: { text: string; start: number; end: number }[] = [];
  let cursor = source.startsWith("\uFEFF") ? 1 : 0;
  while (cursor < source.length) {
    let end = cursor;
    while (end < source.length && source[end] !== "\n" && source[end] !== "\r") end += 1;
    lines.push({ text: source.slice(cursor, end), start: cursor, end });
    cursor = end + (source[end] === "\r" && source[end + 1] === "\n" ? 2 : end < source.length ? 1 : 0);
  }
  if (source.length === 0) return { content: {}, spans: [] };

  const content: Record<string, string> = {};
  const spans: QuestTextSpan[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const first = lines[index];
    const firstContent = first.text.search(/\S/);
    if (firstContent < 0 || first.text[firstContent] === "#" || first.text[firstContent] === "!") continue;

    let logical = first.text;
    let last = first;
    while (hasPropertyContinuation(logical)) {
      logical = logical.slice(0, -1);
      const next = lines[++index];
      if (!next) throw new Error("Unterminated Java language property continuation");
      logical += next.text.replace(/^[ \t\f]+/, "");
      last = next;
    }

    let keyEnd = firstContent;
    while (keyEnd < logical.length) {
      const character = logical[keyEnd];
      if (character === "\\") {
        keyEnd += 2;
        continue;
      }
      if (character === "=" || character === ":" || /[ \t\f]/.test(character)) break;
      keyEnd += 1;
    }
    const key = decodeJavaProperty(logical.slice(firstContent, keyEnd));
    let valueStart = keyEnd;
    while (/[ \t\f]/.test(logical[valueStart] || "")) valueStart += 1;
    if (logical[valueStart] === "=" || logical[valueStart] === ":") valueStart += 1;
    while (/[ \t\f]/.test(logical[valueStart] || "")) valueStart += 1;
    if (!key || valueStart > first.text.length) {
      if (valueStart > first.text.length) throw new Error("Java language property keys cannot continue across lines");
      continue;
    }
    if (Object.hasOwn(content, key)) throw new Error("Duplicate Java language property key: " + key);

    const valueStartOffset = first.start + valueStart;
    spans.push({ key, start: valueStartOffset, end: last.end });
    content[key] = decodeJavaProperty(logical.slice(valueStart));
  }
  return { content, spans };
}

/** Replace .lang values only; comments, keys, separators, and line endings stay intact. */
export function applyJavaLangTranslations(source: string, bundle: QuestTextBundle, translated: Record<string, string>): string {
  const expected = bundle.spans.map((span) => span.key);
  const missing = expected.filter((key) => typeof translated[key] !== "string");
  const extra = Object.keys(translated).filter((key) => !expected.includes(key));
  if (missing.length || extra.length) {
    throw new Error("Invalid .lang translation (missing: " + missing.join(", ") + "; extra: " + extra.join(", ") + ")");
  }
  return [...bundle.spans]
    .sort((left, right) => right.start - left.start)
    .reduce((result, span) => result.slice(0, span.start) + encodeJavaProperty(translated[span.key]) + result.slice(span.end), source);
}

/** Extract BetterQuesting's nested DefaultQuests JSON name/description fields. */
export function extractBetterQuestJsonText(source: string): QuestTextBundle {
  const parsed: unknown = JSON.parse(source.replace(/^\uFEFF/, ""));
  const spans: QuestTextSpan[] = [];
  const content: Record<string, string> = {};
  const visit = (value: unknown, path: (string | number)[]) => {
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, [...path, index]));
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        const childPath = [...path, key];
        if (/^(?:name|Name|desc):\d+$/.test(key) && typeof child === "string" && child.length > 0) {
          const localKey = `quest.text.${spans.length}`;
          spans.push({ key: localKey, start: -1, end: -1, sourceKey: childPath.map(String).map(escapeJsonPointer).join("/") });
          content[localKey] = child;
        } else {
          visit(child, childPath);
        }
      }
    }
  };
  visit(parsed, []);
  return { content, spans };
}

/** Apply translations by stable JSON path and refuse any missing or added text entry. */
export function applyBetterQuestJsonTranslations(source: string, bundle: QuestTextBundle, translated: Record<string, string>): string {
  const expected = bundle.spans.map((span) => span.key);
  const missing = expected.filter((key) => typeof translated[key] !== "string");
  const extra = Object.keys(translated).filter((key) => !expected.includes(key));
  if (missing.length || extra.length) {
    throw new Error("Invalid BetterQuesting translation (missing: " + missing.join(", ") + "; extra: " + extra.join(", ") + ")");
  }
  const result: unknown = JSON.parse(source.replace(/^\uFEFF/, ""));
  for (const span of bundle.spans) {
    const segments = (span.sourceKey || "").split("/").map(unescapeJsonPointer);
    if (segments.length === 0 || segments.some((segment) => !segment)) {
      throw new Error("Invalid BetterQuesting JSON path for " + span.key);
    }
    let parent: unknown = result;
    for (const segment of segments.slice(0, -1)) {
      if (!parent || typeof parent !== "object" || !Object.hasOwn(parent, segment)) {
        throw new Error("BetterQuesting JSON changed at " + span.sourceKey);
      }
      parent = (parent as Record<string, unknown>)[segment];
    }
    const key = segments[segments.length - 1];
    if (!parent || typeof parent !== "object" || !Object.hasOwn(parent, key) || typeof (parent as Record<string, unknown>)[key] !== "string") {
      throw new Error("BetterQuesting JSON text changed at " + span.sourceKey);
    }
    (parent as Record<string, unknown>)[key] = translated[span.key];
  }
  return JSON.stringify(result, null, 2) + "\n";
}

function escapeJsonPointer(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function unescapeJsonPointer(value: string): string {
  return value.replace(/~1/g, "/").replace(/~0/g, "~");
}

function hasPropertyContinuation(line: string): boolean {
  let slashCount = 0;
  for (let index = line.length - 1; index >= 0 && line[index] === "\\"; index -= 1) slashCount += 1;
  return slashCount % 2 === 1;
}

function decodeJavaProperty(value: string): string {
  let decoded = "";
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "\\" || index + 1 >= value.length) {
      decoded += value[index];
      continue;
    }
    const escaped = value[++index];
    const simple: Record<string, string> = { t: "\t", n: "\n", r: "\r", f: "\f" };
    if (escaped === "u") {
      const hex = value.slice(index + 1, index + 5);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error("Invalid Unicode escape in .lang value");
      decoded += String.fromCharCode(parseInt(hex, 16));
      index += 4;
    } else {
      decoded += simple[escaped] ?? escaped;
    }
  }
  return decoded;
}

function encodeJavaProperty(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r").replace(/\f/g, "\\f").replace(/^ +/, (spaces) => "\\ ".repeat(spaces.length));
}

function readQuotedString(source: string, quoteIndex: number): { start: number; end: number; raw: string } | null {
  if (source[quoteIndex] !== '"') {
    return null;
  }

  for (let index = quoteIndex + 1; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] === '"') {
      return {
        start: quoteIndex + 1,
        end: index,
        raw: source.slice(quoteIndex + 1, index)
      };
    }
  }

  return null;
}

function skipWhitespace(source: string, index: number): number {
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }
  return index;
}

function findClosingBracket(source: string, openingIndex: number): number {
  let depth = 0;
  for (let index = openingIndex; index < source.length; index += 1) {
    if (source[index] === '"') {
      const quoted = readQuotedString(source, index);
      if (quoted) {
        index = quoted.end;
      }
      continue;
    }
    if (source[index] === "[") {
      depth += 1;
    } else if (source[index] === "]") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function decodeSnbtString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    // Keep unusual SNBT escape sequences intact rather than corrupting them.
    return raw;
  }
}

function collectQuotedStrings(source: string, start: number, end: number, spans: QuestTextSpan[], sourceKey?: string): void {
  let valueIndex = 0;
  for (let index = start; index < end; index += 1) {
    if (source[index] !== '"') {
      continue;
    }
    const quoted = readQuotedString(source, index);
    if (!quoted) {
      return;
    }
    if (quoted.raw.length > 0) {
      spans.push({
        key: "",
        start: quoted.start,
        end: quoted.end,
        sourceKey: sourceKey ? `${sourceKey}#${valueIndex}` : undefined
      });
      valueIndex += 1;
    }
    index = quoted.end;
  }
}

/** Extract only user-visible FTB Quest text while leaving SNBT syntax untouched. */
export function extractQuestText(source: string): QuestTextBundle {
  const spans: QuestTextSpan[] = [];

  for (let index = 0; index < source.length;) {
    if (source[index] === '"') {
      const quoted = readQuotedString(source, index);
      index = quoted ? quoted.end + 1 : index + 1;
      continue;
    }

    if (!/[A-Za-z_]/.test(source[index])) {
      index += 1;
      continue;
    }

    const wordStart = index;
    while (index < source.length && /[A-Za-z0-9_.-]/.test(source[index])) {
      index += 1;
    }
    const field = source.slice(wordStart, index);
    const isTitle = field === "title" || field.endsWith(".title");
    const isSubtitle = field === "subtitle" || field.endsWith(".subtitle")
      || field === "chapter_subtitle" || field.endsWith(".chapter_subtitle")
      || field === "quest_subtitle" || field.endsWith(".quest_subtitle");
    const isDescription = field === "description" || field.endsWith(".description")
      || field === "quest_desc" || field.endsWith(".quest_desc");
    if (!isTitle && !isSubtitle && !isDescription) {
      continue;
    }

    const colon = skipWhitespace(source, index);
    if (source[colon] !== ":") {
      continue;
    }
    const valueStart = skipWhitespace(source, colon + 1);

    if ((isDescription || isSubtitle) && source[valueStart] === "[") {
      const closingBracket = findClosingBracket(source, valueStart);
      if (closingBracket >= 0) {
        collectQuotedStrings(source, valueStart + 1, closingBracket, spans, field.includes(".") ? field : undefined);
        index = closingBracket + 1;
      }
      continue;
    }

    if (isTitle || isSubtitle || isDescription) {
      const quoted = readQuotedString(source, valueStart);
      if (quoted && quoted.raw.length > 0) {
        spans.push({ key: "", start: quoted.start, end: quoted.end, sourceKey: field.includes(".") ? field : undefined });
        index = quoted.end + 1;
      }
    }
  }

  spans.sort((left, right) => left.start - right.start);
  const content: Record<string, string> = {};
  spans.forEach((span, index) => {
    span.key = `quest.text.${index}`;
    content[span.key] = decodeSnbtString(source.slice(span.start, span.end));
  });

  return { content, spans };
}

/** Apply validated translations in reverse offset order to preserve the source SNBT structure. */
export function applyQuestTranslations(
  source: string,
  bundle: QuestTextBundle,
  translated: Record<string, string>
): string {
  const expectedKeys = bundle.spans.map((span) => span.key);
  const missingKeys = expectedKeys.filter((key) => typeof translated[key] !== "string");
  const extraKeys = Object.keys(translated).filter((key) => !expectedKeys.includes(key));
  if (missingKeys.length || extraKeys.length) {
    throw new Error(`Invalid quest translation schema (missing: ${missingKeys.join(", ")}; extra: ${extraKeys.join(", ")})`);
  }

  return [...bundle.spans]
    .sort((left, right) => right.start - left.start)
    .reduce((result, span) => {
      const replacement = JSON.stringify(translated[span.key]);
      return result.slice(0, span.start) + replacement.slice(1, -1) + result.slice(span.end);
    }, source);
}
