export const APP_LANGUAGES = ['en', 'ja', 'zh-CN', 'ko', 'de', 'fr', 'es', 'it', 'pt-BR', 'ru'];

/** Match each OS preference in order, including regional variants. */
export function resolveAppLanguage(languages: string | readonly string[] | undefined): string {
  for (const language of typeof languages === 'string' ? [languages] : languages ?? []) {
    const normalized = language.replaceAll('_', '-').toLowerCase();
    const match = APP_LANGUAGES.find(code => code.toLowerCase() === normalized)
      ?? APP_LANGUAGES.find(code => code.toLowerCase().split('-')[0] === normalized.split('-')[0]);
    if (match) return match;
  }
  return 'en';
}
