/**
 * Parser / serializer for the consolidated FTB Quests language SNBT format
 * introduced around Minecraft 1.21.
 *
 * Modern FTB Quests stores every translatable string in `lang/<locale>.snbt`;
 * Quests Lang Splitter may partition that same flat map into files under
 * `lang/<locale>/`. Per-quest chapter files only reference lang keys. Values
 * are either a quoted string or an array of quoted strings:
 *
 * ```
 * {
 * 	chapter.007B547630FF0478.title: "Theurgy"
 * 	quest.00075A5F9AC120ED.quest_subtitle: "Always Required"
 * 	quest.00075A5F9AC120ED.quest_desc: ["This will take the items out."]
 * 	quest.002163B909070CF8.quest_desc: [
 * 		"Allows you to see details about certain blocks.\\n"
 * 		"{image:atm:textures/...png width:150 height:150}"
 * 	]
 * }
 * ```
 *
 * Every value is display text, so the whole file is translatable. We parse it
 * into ordered entries, expose a `Record<string, string>` for the existing
 * chunked translation pipeline, and serialize the translated map back to valid
 * SNBT. String payloads are preserved verbatim (including `\\n`, `&` colour
 * codes and `{image:...}` tokens) so markup round-trips losslessly.
 */

/** A single key/value entry from a consolidated FTB Quests lang file. */
export interface FtbLangEntry {
  /** The lang key, e.g. `quest.00075A5F9AC120ED.quest_desc`. */
  key: string;
  /** Whether the SNBT value was an array (`[...]`) rather than a bare string. */
  isArray: boolean;
  /**
   * The raw inner text of each quoted string, verbatim and still escaped
   * (i.e. without the surrounding quotes). Non-array entries have length 1.
   */
  values: string[];
}

/**
 * Returns true when the given path is a consolidated FTB Quests lang file
 * (`.../config/ftbquests/quests/lang/<code>.snbt`). Accepts both `/` and `\`
 * separators so it works on Windows paths too.
 */
export function isFtbConsolidatedLangPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  return /\/ftbquests\/(?:quests|normal)\/lang\/[a-z]{2}_[a-z]{2}\.snbt$/.test(normalized);
}

/**
 * True for English FTB Quests language files, either consolidated or split by
 * Quests Lang Splitter. Only these files are translation inputs; chapter data
 * and already-translated locales must never be sent through the SNBT pipeline.
 */
export function isFtbQuestLangSourcePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  return /\/ftbquests\/(?:quests|normal)\/lang\/en_us(?:\.snbt|\/.+\.snbt(?:_merged)?)$/.test(
    normalized,
  );
}

/**
 * Resolve the locale-specific output path for an English FTB Quests language
 * file. Splitter output always uses active `.snbt` files, even if its English
 * input is currently parked as `.snbt_merged`.
 */
export function getFtbQuestLangOutputPath(
  sourcePath: string,
  targetLanguage: string,
): string | null {
  const locale = targetLanguage.trim().toLowerCase();
  if (!/^[a-z]{2}_[a-z]{2}$/.test(locale) || !isFtbQuestLangSourcePath(sourcePath)) {
    return null;
  }

  const normalized = sourcePath.replace(/\\/g, "/");
  const consolidated = normalized.match(
    /^(.*\/ftbquests\/(?:quests|normal)\/lang\/)en_us\.snbt$/i,
  );
  const split = normalized.match(
    /^(.*\/ftbquests\/(?:quests|normal)\/lang\/)en_us\/(.+)\.snbt(?:_merged)?$/i,
  );
  const output = consolidated
    ? `${consolidated[1]}${locale}.snbt`
    : split
      ? `${split[1]}${locale}/${split[2]}.snbt`
      : null;

  return output && sourcePath.includes("\\") ? output.replace(/\//g, "\\") : output;
}

/**
 * Builds the translation-map key used to feed a single string into the
 * translation pipeline. Array elements get an `[index]` suffix so they stay
 * unique and human-readable.
 */
function mapKeyFor(key: string, index: number, isArray: boolean): string {
  return isArray ? `${key}[${index}]` : key;
}

/**
 * Parse a consolidated FTB Quests lang SNBT file into ordered entries.
 *
 * The parser is a small hand-written tokenizer rather than a full SNBT parser:
 * it only needs to handle the flat `key: <string | string[]>` shape that FTB
 * emits for lang files. Unsupported or malformed SNBT fails closed so it can
 * never be rewritten as a silently truncated translation.
 */
export function parseFtbQuestLang(content: string): FtbLangEntry[] {
  const entries: FtbLangEntry[] = [];
  const len = content.length;
  let i = content.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (i < len && /\s/.test(content[i])) i++;
  if (content[i] !== "{") {
    throw new Error("Invalid FTB Quests lang SNBT: expected an outer compound");
  }
  i++;
  let closed = false;
  const seenKeys = new Set<string>();

  while (i < len) {
    // Skip whitespace and structural commas between entries.
    while (i < len && /[\s,]/.test(content[i])) i++;
    if (i >= len) break;
    if (content[i] === "}") {
      i++;
      closed = true;
      break;
    }

    // Read the key up to the `:` separator (keys are unquoted, no whitespace).
    const keyStart = i;
    while (i < len && content[i] !== ":" && content[i] !== "}") i++;
    if (i >= len || content[i] === "}") {
      throw new Error("Invalid FTB Quests lang SNBT: entry is missing ':'");
    }
    const key = content.slice(keyStart, i).trim();
    if (!key || /\s/.test(key) || seenKeys.has(key)) {
      throw new Error(`Invalid FTB Quests lang SNBT: invalid or duplicate key '${key}'`);
    }
    seenKeys.add(key);
    i++; // consume `:`

    // Skip whitespace before the value.
    while (i < len && /\s/.test(content[i])) i++;
    if (i >= len) {
      throw new Error(`Invalid FTB Quests lang SNBT: missing value for '${key}'`);
    }

    if (content[i] === "[") {
      // Array value: collect every quoted string until the matching `]`.
      i++; // consume `[`
      const values: string[] = [];
      while (i < len) {
        while (i < len && /[\s,]/.test(content[i])) i++;
        if (i >= len || content[i] === "]") break;
        if (content[i] === '"') {
          const { raw, next } = readQuotedString(content, i);
          values.push(raw);
          i = next;
        } else {
          throw new Error(`Invalid FTB Quests lang SNBT: expected a string in '${key}'`);
        }
      }
      if (i >= len || content[i] !== "]") {
        throw new Error(`Invalid FTB Quests lang SNBT: unterminated array for '${key}'`);
      }
      i++; // consume `]`
      entries.push({ key, isArray: true, values });
    } else if (content[i] === '"') {
      const { raw, next } = readQuotedString(content, i);
      entries.push({ key, isArray: false, values: [raw] });
      i = next;
    } else {
      throw new Error(`Invalid FTB Quests lang SNBT: expected a string or string array for '${key}'`);
    }
  }

  if (!closed) {
    throw new Error("Invalid FTB Quests lang SNBT: unterminated outer compound");
  }
  while (i < len && /\s/.test(content[i])) i++;
  if (i !== len) {
    throw new Error("Invalid FTB Quests lang SNBT: unexpected content after outer compound");
  }

  return entries;
}

/**
 * Read a quoted SNBT string starting at `start` (which must point at the
 * opening `"`). Returns the raw inner text (verbatim, still escaped, without
 * the surrounding quotes) and the index just past the closing quote.
 */
function readQuotedString(
  content: string,
  start: number,
): { raw: string; next: number } {
  const len = content.length;
  let i = start + 1; // skip opening quote
  const innerStart = i;
  while (i < len) {
    const ch = content[i];
    if (ch === "\\") {
      i += 2; // skip the escaped character (e.g. \" or \\)
      continue;
    }
    if (ch === '"') break;
    i++;
  }
  if (i >= len) {
    throw new Error("Invalid FTB Quests lang SNBT: unterminated quoted string");
  }
  const raw = content.slice(innerStart, i);
  return { raw, next: i + 1 }; // +1 to consume closing quote
}

/**
 * Flatten parsed entries into a `Record<string, string>` for the chunked
 * translation pipeline. Keys mirror the lang keys (with `[index]` for arrays);
 * values are the raw, still-escaped string payloads. Empty strings are kept so
 * the output preserves the original structure.
 */
export function ftbQuestLangToMap(
  entries: FtbLangEntry[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of entries) {
    entry.values.forEach((value, index) => {
      map[mapKeyFor(entry.key, index, entry.isArray)] = value;
    });
  }
  return map;
}

/**
 * Serialize entries back to a valid SNBT lang file, substituting translated
 * strings from `translated` where present and falling back to the original
 * value otherwise. Output is canonical (tab-indented) form; FTB rewrites the
 * file on load anyway, so exact byte formatting is not required.
 */
export function mapToFtbQuestLang(
  entries: FtbLangEntry[],
  translated: Record<string, string>,
): string {
  const lines: string[] = ["{"];

  for (const entry of entries) {
    const resolved = entry.values.map((original, index) => {
      const k = mapKeyFor(entry.key, index, entry.isArray);
      const value = translated[k];
      return value !== undefined && value !== null ? value : original;
    });

    if (entry.isArray) {
      if (resolved.length === 0) {
        lines.push(`\t${entry.key}: [ ]`);
      } else if (resolved.length === 1) {
        lines.push(`\t${entry.key}: [${quoteSnbtString(resolved[0])}]`);
      } else {
        lines.push(`\t${entry.key}: [`);
        for (const value of resolved) {
          lines.push(`\t\t${quoteSnbtString(value)}`);
        }
        lines.push("\t]");
      }
    } else {
      lines.push(`\t${entry.key}: ${quoteSnbtString(resolved[0])}`);
    }
  }

  lines.push("}");
  return lines.join("\n") + "\n";
}

/**
 * Reject incomplete or key-shifted model results before writing a lang file.
 * Partial chunks are intentionally not serialized as a seemingly complete file.
 */
export function validateFtbQuestLangTranslation(
  entries: FtbLangEntry[],
  translated: Record<string, string>,
): void {
  const sourceMap = ftbQuestLangToMap(entries);
  const sourceKeys = Object.keys(sourceMap);
  const sourceKeySet = new Set(sourceKeys);
  const translatedKeys = Object.keys(translated);
  const missing = sourceKeys.filter((key) => !Object.hasOwn(translated, key));
  const unexpected = translatedKeys.filter((key) => !sourceKeySet.has(key));

  if (missing.length || unexpected.length) {
    throw new Error(
      `FTB Quests translation key mismatch (${missing.length} missing, ${unexpected.length} unexpected)`,
    );
  }
  if (translatedKeys.some((key) => typeof translated[key] !== "string")) {
    throw new Error("FTB Quests translation contains a non-string value");
  }
}

/** Preserve existing SNBT escapes while escaping model-produced quotes/control characters. */
function quoteSnbtString(value: string): string {
  let escaped = '"';

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "\\") {
      const next = value[i + 1];
      if (next === undefined) {
        escaped += "\\\\";
      } else if ('"\\nrtbf'.includes(next)) {
        escaped += `\\${next}`;
        i++;
      } else if (next === "u" && /^[0-9a-f]{4}$/i.test(value.slice(i + 2, i + 6))) {
        escaped += value.slice(i, i + 6);
        i += 5;
      } else {
        escaped += `\\\\${next}`;
        i++;
      }
    } else if (char === '"') {
      escaped += '\\"';
    } else if (char === "\n") {
      escaped += "\\n";
    } else if (char === "\r") {
      escaped += "\\r";
    } else if (char === "\t") {
      escaped += "\\t";
    } else {
      escaped += char;
    }
  }

  return `${escaped}"`;
}
