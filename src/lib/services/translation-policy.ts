export function normalizeLanguageId(language: string): string {
  return language.trim().toLowerCase().replace(/-/g, "_");
}

export function isRetranslationRequested(target: { forceTranslationLanguage?: string }, language: string): boolean {
  const normalized = normalizeLanguageId(language);
  return !!normalized && normalizeLanguageId(target.forceTranslationLanguage || "") === normalized;
}
