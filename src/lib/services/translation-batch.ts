export interface TranslationBatch {
  content: Record<string, string>;
  keyByText: Map<string, string>;
}

export function createTranslationBatch(): TranslationBatch {
  return { content: {}, keyByText: new Map() };
}

/** Add local file strings to a shared batch, deduplicating identical non-empty text. */
export function addToTranslationBatch(
  batch: TranslationBatch,
  source: Record<string, string>
): Record<string, string | null> {
  const batchKeyByLocalKey: Record<string, string | null> = {};

  for (const [localKey, text] of Object.entries(source)) {
    if (text.length === 0) {
      batchKeyByLocalKey[localKey] = null;
      continue;
    }

    let batchKey = batch.keyByText.get(text);
    if (!batchKey) {
      batchKey = `batch.text.${batch.keyByText.size}`;
      batch.keyByText.set(text, batchKey);
      batch.content[batchKey] = text;
    }
    batchKeyByLocalKey[localKey] = batchKey;
  }

  return batchKeyByLocalKey;
}

/** Rebuild a file-local result, preserving empty source strings and rejecting missing data. */
export function restoreBatchedTranslations(
  source: Record<string, string>,
  batchKeyByLocalKey: Record<string, string | null>,
  translated: Record<string, string>
): Record<string, string> {
  const sourceKeys = Object.keys(source);
  const mappingKeys = Object.keys(batchKeyByLocalKey);
  if (sourceKeys.length !== mappingKeys.length || sourceKeys.some((key) => !Object.hasOwn(batchKeyByLocalKey, key))) {
    throw new Error("Invalid translation batch mapping");
  }

  return Object.fromEntries(sourceKeys.map((localKey) => {
    const batchKey = batchKeyByLocalKey[localKey];
    if (batchKey === null && source[localKey] === "") return [localKey, ""];
    if (!batchKey || typeof translated[batchKey] !== "string") {
      throw new Error(`Missing batched translation for ${localKey}`);
    }
    return [localKey, translated[batchKey]];
  }));
}
