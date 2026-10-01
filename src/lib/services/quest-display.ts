import { getFileName } from "../utils/path-utils";
import { extractQuestText } from "./quest-text";

// Read chapter metadata without mistaking nested quest/item titles and IDs for it.
function chapterFields(source: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const tokens = [...source.matchAll(/"(?:\\.|[^"\\])*"|#[^\n]*|\/\/[^\n]*|[{}\[\]]|[\w.]+|:/g)];
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i][0];
    if (token === "{" || token === "[") depth++;
    else if (token === "}" || token === "]") depth--;
    else if (depth === 1 && (token === "title" || token === "id") && tokens[i + 1]?.[0] === ":") {
      const value = tokens[i + 2]?.[0];
      if (value?.startsWith('"')) {
        try { fields[token] = JSON.parse(value); } catch { /* Use the filename for unsupported text. */ }
      }
    }
  }
  return fields;
}

/** Resolve a chapter title; shared language files keep their short filename. */
export async function getQuestDisplayName(path: string, read: (path: string) => Promise<string>): Promise<string> {
  const fallback = getFileName(path).replace(/\.(?:snbt(?:_merged)?|json|lang)$/i, "");
  const normalized = path.replace(/\\/g, "/");
  const chapter = normalized.match(/^(.*\/(?:quests|normal))\/(?:lang\/en_us\/)?chapters\/(.+\.snbt)(?:_merged)?$/i);
  if (!chapter) return fallback;
  try {
    const fields = chapterFields(await read(`${chapter[1]}/chapters/${chapter[2]}`));
    let title = fields.title;
    if (!title && fields.id) {
      for (const langPath of [`${chapter[1]}/lang/en_us/chapter.snbt`, `${chapter[1]}/lang/en_us.snbt`]) {
        try {
          const bundle = extractQuestText(await read(langPath));
          const span = bundle.spans.find(s => s.sourceKey === `chapter.${fields.id}.title`);
          if (span) { title = bundle.content[span.key]; break; }
        } catch { /* Older packs may store their titles directly in the chapter. */ }
      }
    }
    return title?.replace(/[&§][0-9a-fk-or]/gi, "").trim() || fallback;
  } catch {
    return fallback;
  }
}
