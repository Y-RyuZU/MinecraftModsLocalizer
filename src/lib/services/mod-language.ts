import { isRetranslationRequested, normalizeLanguageId } from "./translation-policy";
export { normalizeLanguageId } from "./translation-policy";
import type { TranslationTarget } from "@/lib/types/minecraft";
import type { LangFile } from "@/lib/types/minecraft";

export interface NamespaceLanguageGroup {
  resourceNamespace: string;
  fileExtension: "json" | "lang";
  content: Record<string, string>;
  structuredContent?: Record<string, unknown>;
}

const COMPONENT_TRANSLATION_KEY_PREFIX = "__mml_component__";
type JsonPathPart = string | number;

function componentTranslationKey(rootKey: string, path: JsonPathPart[]): string {
  return COMPONENT_TRANSLATION_KEY_PREFIX + JSON.stringify([rootKey, path]);
}

function collectComponentText(
  value: unknown,
  rootKey: string,
  path: JsonPathPart[],
  output: Map<string, JsonPathPart[]>
): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      const childPath = [...path, index];
      if (typeof child === "string") {
        if (/\p{L}/u.test(child)) output.set(componentTranslationKey(rootKey, childPath), childPath);
      } else {
        collectComponentText(child, rootKey, childPath, output);
      }
    });
    return;
  }

  if (!value || typeof value !== "object") return;
  const component = value as Record<string, unknown>;
  if (Object.hasOwn(component, "text")) {
    const textPath = [...path, "text"];
    const text = component.text;
    if (typeof text === "string") {
      if (/\p{L}/u.test(text)) output.set(componentTranslationKey(rootKey, textPath), textPath);
    } else {
      collectComponentText(text, rootKey, textPath, output);
    }
  }
  if (Array.isArray(component.extra) || (component.extra && typeof component.extra === "object")) {
    collectComponentText(component.extra, rootKey, [...path, "extra"], output);
  }
}

/** Rebuild rich-text JSON values after the model translates only their text leaves. */
export function applyStructuredJsonTranslations(
  structuredContent: Record<string, unknown>,
  translated: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(translated)) {
    if (!key.startsWith(COMPONENT_TRANSLATION_KEY_PREFIX)) result[key] = value;
  }

  const expectedComponentKeys = new Set<string>();
  for (const [rootKey, source] of Object.entries(structuredContent)) {
    const leaves = new Map<string, JsonPathPart[]>();
    collectComponentText(source, rootKey, [], leaves);
    if (leaves.size === 0) continue;

    const copy = JSON.parse(JSON.stringify(source)) as unknown;
    for (const [translationKey, path] of leaves) {
      expectedComponentKeys.add(translationKey);
      if (typeof translated[translationKey] !== "string") {
        throw new Error(`Missing structured language translation: ${translationKey}`);
      }
      let parent = copy;
      for (const part of path.slice(0, -1)) {
        if (Array.isArray(parent) && typeof part === "number") parent = parent[part];
        else if (parent && typeof parent === "object" && typeof part === "string") {
          parent = (parent as Record<string, unknown>)[part];
        } else throw new Error(`Invalid structured language path: ${translationKey}`);
      }
      const finalPart = path.at(-1);
      if (Array.isArray(parent) && typeof finalPart === "number") parent[finalPart] = translated[translationKey];
      else if (parent && typeof parent === "object" && typeof finalPart === "string") {
        (parent as Record<string, unknown>)[finalPart] = translated[translationKey];
      } else throw new Error(`Invalid structured language path: ${translationKey}`);
    }
    result[rootKey] = copy;
  }

  const unexpected = Object.keys(translated).filter((key) =>
    key.startsWith(COMPONENT_TRANSLATION_KEY_PREFIX) && !expectedComponentKeys.has(key)
  );
  if (unexpected.length) throw new Error(`Unexpected structured language translation keys: ${unexpected.join(", ")}`);
  return result;
}


export function indexResourcePackLanguageFiles(filePaths: string[]): Record<string, Partial<Record<"json" | "lang", string[]>>> {
  const languages: Record<string, Partial<Record<"json" | "lang", string[]>>> = {};
  for (const filePath of filePaths) {
    const match = filePath.replace(/\\/g, "/").match(/(?:^|\/)assets\/([^/]+)\/lang\/([^/]+)\.(json|lang)$/i);
    if (!match) continue;
    const namespace = match[1];
    const language = normalizeLanguageId(match[2]);
    const extension = match[3].toLowerCase() as "json" | "lang";
    const byFormat = languages[namespace] ?? (languages[namespace] = {});
    const locales = byFormat[extension] ?? (byFormat[extension] = []);
    if (!locales.includes(language)) locales.push(language);
  }
  return languages;
}

export function hasNamespaceLanguage(
  target: Pick<TranslationTarget, "availableLanguages" | "availableLanguagesByNamespace" | "availableLanguagesByNamespaceAndFormat">,
  namespace: string,
  targetLanguage: string,
  fileExtension?: "json" | "lang"
): boolean {
  if (fileExtension && target.availableLanguagesByNamespaceAndFormat) {
    return target.availableLanguagesByNamespaceAndFormat[namespace]?.[fileExtension]
      ?.some((available) => normalizeLanguageId(available) === normalizeLanguageId(targetLanguage)) ?? false;
  }
  const languages = target.availableLanguagesByNamespace?.[namespace]
    ?? (target.availableLanguagesByNamespace ? [] : target.availableLanguages);
  return languages?.some((available) => normalizeLanguageId(available) === normalizeLanguageId(targetLanguage)) ?? false;
}

export function hasResourcePackLanguage(
  target: Pick<TranslationTarget, "resourcePackLanguagesByNamespaceAndFormat">,
  namespace: string,
  targetLanguage: string,
  fileExtension: "json" | "lang"
): boolean {
  return target.resourcePackLanguagesByNamespaceAndFormat?.[namespace]?.[fileExtension]
    ?.some((available) => normalizeLanguageId(available) === normalizeLanguageId(targetLanguage)) ?? false;
}

/** Select missing locale keys and values that are still identical to their English source. */
export function getUntranslatedLanguageEntries(
  source: Record<string, string>,
  target: Record<string, unknown>
): Record<string, string> {
  return Object.fromEntries(Object.entries(source).filter(([key, value]) =>
    !Object.hasOwn(target, key) || target[key] === value
  ));
}

/** Keep each resource namespace and legacy/modern language format as its own output unit. */
export function groupEnglishLangFilesByNamespace(langFiles: LangFile[]): NamespaceLanguageGroup[] {
  const groups = new Map<string, NamespaceLanguageGroup>();
  for (const file of langFiles) {
    if (normalizeLanguageId(file.language) !== "en_us") continue;
    const match = file.path.replace(/\\/g, "/").match(/(?:^|\/)assets\/([^/]+)\/lang\/[^/]+\.(json|lang)$/i);
    if (!match) continue;
    const resourceNamespace = match[1];
    const fileExtension = match[2].toLowerCase() as "json" | "lang";
    const groupKey = `${resourceNamespace}\0${fileExtension}`;
    const group = groups.get(groupKey) ?? { resourceNamespace, fileExtension, content: {} };
    // Archive order gives deterministic precedence when same-format source files repeat a key.
    Object.assign(group.content, file.content);
    if (file.structuredContent) {
      group.structuredContent ??= {};
      Object.assign(group.structuredContent, file.structuredContent);
    }
    groups.set(groupKey, group);
  }
  return [...groups.values()];
}

export function shouldTranslateMod(
  target: Pick<TranslationTarget, "availableLanguages" | "availableLanguagesByNamespace" | "availableLanguagesByNamespaceAndFormat" | "resourcePackLanguagesByNamespaceAndFormat" | "forceTranslationLanguage">,
  targetLanguage: string
): boolean {
  const language = normalizeLanguageId(targetLanguage);
  if (isRetranslationRequested(target, language)) return true;
  if (target.availableLanguagesByNamespaceAndFormat) {
    const englishGroups = Object.entries(target.availableLanguagesByNamespaceAndFormat).flatMap(([namespace, byFormat]) =>
      (["json", "lang"] as const)
        .filter((extension) => byFormat[extension]?.some((available) => normalizeLanguageId(available) === "en_us"))
        .map((extension) => ({ namespace, extension }))
    );
    if (englishGroups.length > 0) {
      return englishGroups.some(({ namespace, extension }) =>
        !hasNamespaceLanguage(target, namespace, language, extension)
        && !hasResourcePackLanguage(target, namespace, language, extension)
      );
    }
    const formats = Object.values(target.availableLanguagesByNamespaceAndFormat).flatMap((byFormat) => Object.values(byFormat));
    if (formats.length > 0) {
      return !formats.every((languages) => languages?.some((available) => normalizeLanguageId(available) === language));
    }
  }
  if (target.availableLanguagesByNamespace && Object.keys(target.availableLanguagesByNamespace).length > 0) {
    return !Object.values(target.availableLanguagesByNamespace).every((languages) =>
      languages.some((available) => normalizeLanguageId(available) === language)
    );
  }
  return !target.availableLanguages?.some((available) => normalizeLanguageId(available) === language);
}

export function hasExistingModTranslation(target: TranslationTarget, language: string): boolean {
  const languages = [
    ...(target.availableLanguages || []),
    ...Object.values(target.availableLanguagesByNamespace || {}).flat(),
    ...Object.values(target.availableLanguagesByNamespaceAndFormat || {}).flatMap(formats => Object.values(formats).flat()),
    ...Object.values(target.resourcePackLanguagesByNamespaceAndFormat || {}).flatMap(formats => Object.values(formats).flat())
  ];
  return languages.some(available => normalizeLanguageId(available) === normalizeLanguageId(language));
}
