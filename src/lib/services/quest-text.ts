export interface QuestTextSpan {
  key: string;
  start: number;
  end: number;
}

export interface QuestTextBundle {
  content: Record<string, string>;
  spans: QuestTextSpan[];
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

function collectQuotedStrings(source: string, start: number, end: number, spans: QuestTextSpan[]): void {
  for (let index = start; index < end; index += 1) {
    if (source[index] !== '"') {
      continue;
    }
    const quoted = readQuotedString(source, index);
    if (!quoted) {
      return;
    }
    if (quoted.raw.length > 0) {
      spans.push({ key: "", start: quoted.start, end: quoted.end });
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
    const isTitle = field === "title" || field.endsWith(".title")
      || field === "subtitle" || field.endsWith(".subtitle")
      || field === "chapter_subtitle" || field.endsWith(".chapter_subtitle");
    const isDescription = field === "description" || field.endsWith(".description");
    if (!isTitle && !isDescription) {
      continue;
    }

    const colon = skipWhitespace(source, index);
    if (source[colon] !== ":") {
      continue;
    }
    const valueStart = skipWhitespace(source, colon + 1);

    if ((isDescription || field === "chapter_subtitle" || field.endsWith(".chapter_subtitle"))
      && source[valueStart] === "[") {
      const closingBracket = findClosingBracket(source, valueStart);
      if (closingBracket >= 0) {
        collectQuotedStrings(source, valueStart + 1, closingBracket, spans);
        index = closingBracket + 1;
      }
      continue;
    }

    if (isTitle) {
      const quoted = readQuotedString(source, valueStart);
      if (quoted && quoted.raw.length > 0) {
        spans.push({ key: "", start: quoted.start, end: quoted.end });
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
