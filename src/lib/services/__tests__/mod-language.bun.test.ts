import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { applyStructuredJsonTranslations, getUntranslatedLanguageEntries, groupEnglishLangFilesByNamespace, hasNamespaceLanguage, hasResourcePackLanguage, indexResourcePackLanguageFiles, normalizeLanguageId, shouldTranslateMod } from "../mod-language";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("existing mod translations", () => {
  test("normalizes Minecraft locale separators and casing", () => {
    expect(normalizeLanguageId(" JA-JP ")).toBe("ja_jp");
  });

  test("skips a mod that already has the selected language", () => {
    expect(shouldTranslateMod({ availableLanguages: ["JA-JP"] }, "ja_jp")).toBe(false);
  });

  test("translates when the selected language is absent", () => {
    expect(shouldTranslateMod({ availableLanguages: ["en_us"] }, "ja_jp")).toBe(true);
  });

  test("selects only missing or still-English entries while preserving existing translations", () => {
    expect(getUntranslatedLanguageEntries(
      { missing: "New text", unchanged: "Same text", translated: "Original text" },
      { unchanged: "Same text", translated: "翻訳済み", unrelated: "Keep me" }
    )).toEqual({ missing: "New text", unchanged: "Same text" });
  });

  test("force applies only to the locale the user explicitly selected", () => {
    const target = { availableLanguages: ["ja_jp", "zh_cn"], forceTranslationLanguage: "ja_jp" };
    expect(shouldTranslateMod(target, "ja-JP")).toBe(true);
    expect(shouldTranslateMod(target, "zh_cn")).toBe(false);
  });

  test("checks existing locales per English namespace rather than across the entire JAR", () => {
    const partial = {
      availableLanguages: ["en_us", "ja_jp"],
      availableLanguagesByNamespace: {
        create_enchantment_industry: ["en_us", "ja_jp"],
        create_dragons_plus: ["en_us"]
      }
    };
    expect(shouldTranslateMod(partial, "ja_jp")).toBe(true);
    expect(hasNamespaceLanguage(partial, "create_enchantment_industry", "ja_jp")).toBe(true);
    expect(hasNamespaceLanguage(partial, "create_dragons_plus", "ja_jp")).toBe(false);
    expect(shouldTranslateMod({ ...partial, availableLanguagesByNamespace: {
      create_enchantment_industry: ["en_us", "ja_jp"], create_dragons_plus: ["en_us", "ja_jp"]
    } }, "ja_jp")).toBe(false);
  });

  test("does not skip a missing language format when another format exists in the same namespace", () => {
    const target = {
      availableLanguages: ["en_us", "ja_jp"],
      availableLanguagesByNamespace: { industrialforegoing: ["en_us", "ja_jp"] },
      availableLanguagesByNamespaceAndFormat: {
        industrialforegoing: { json: ["en_us", "ja_jp"], lang: ["en_us"] }
      }
    };
    expect(shouldTranslateMod(target, "ja_jp")).toBe(true);
    expect(hasNamespaceLanguage(target, "industrialforegoing", "ja_jp", "json")).toBe(true);
    expect(hasNamespaceLanguage(target, "industrialforegoing", "ja_jp", "lang")).toBe(false);
  });

  test("indexes completed resource-pack locales and skips them on resume", () => {
    const resourcePackLanguagesByNamespaceAndFormat = indexResourcePackLanguageFiles([
      "C:\\ATM10\\resourcepacks\\MML\\assets\\actuallyadditions\\lang\\ja_jp.json",
      "/ATM10/resourcepacks/MML/assets/industrialforegoing/lang/ja_jp.lang",
      "/ATM10/resourcepacks/MML/assets/not-a-locale/readme.json",
    ]);
    expect(resourcePackLanguagesByNamespaceAndFormat).toEqual({
      actuallyadditions: { json: ["ja_jp"] },
      industrialforegoing: { lang: ["ja_jp"] },
    });

    const completed = {
      availableLanguagesByNamespaceAndFormat: { actuallyadditions: { json: ["en_us"] } },
      resourcePackLanguagesByNamespaceAndFormat,
    };
    expect(hasResourcePackLanguage(completed, "actuallyadditions", "JA-JP", "json")).toBe(true);
    expect(shouldTranslateMod(completed, "ja_jp")).toBe(false);
    expect(shouldTranslateMod({
      ...completed,
      availableLanguagesByNamespaceAndFormat: { actuallyadditions: { json: ["en_us"], lang: ["en_us"] } },
    }, "ja_jp")).toBe(true);
  });

  test("merges same-format files within a namespace and keeps namespaces/formats separate", () => {
    const groups = groupEnglishLangFilesByNamespace([
      { language: "en_us", path: "assets/example/lang/en_us.json", content: { one: "One" } },
      { language: "en_us", path: "assets/example/lang/en_us-extra.json", content: { two: "Two" } },
      { language: "en_us", path: "assets/example/lang/en_us.lang", content: { three: "Three" } },
      { language: "en_us", path: "assets/other/lang/en_us.json", content: { four: "Four" } }
    ]);
    expect(groups).toEqual([
      { resourceNamespace: "example", fileExtension: "json", content: { one: "One", two: "Two" } },
      { resourceNamespace: "example", fileExtension: "lang", content: { three: "Three" } },
      { resourceNamespace: "other", fileExtension: "json", content: { four: "Four" } }
    ]);
  });

  test("rebuilds Owo rich-text JSON while translating only text leaves", () => {
    const source = JSON.parse(fixture("owo-rich-en_us.json")) as Record<string, unknown>;
    const translationKey = (root: string, path: Array<string | number>) => `__mml_component__${JSON.stringify([root, path])}`;
    const translated = {
      [translationKey("text.owo.itemGroup.select_hint", ["text"])]: "複数選択するにはShiftキーを押してください",
      [translationKey("text.owo.config.boolean_toggle.enabled", [4])]: "有効"
    };

    const [group] = groupEnglishLangFilesByNamespace([{
      language: "en_us",
      path: "assets/owo/lang/en_us.json",
      content: translated,
      structuredContent: source
    }]);
    const output = applyStructuredJsonTranslations(group.structuredContent!, group.content);
    expect(output["text.owo.itemGroup.select_hint"]).toEqual({
      text: "複数選択するにはShiftキーを押してください",
      color: "gray"
    });
    expect(output["text.owo.config.boolean_toggle.enabled"]).toEqual([
      "",
      { text: "[", color: "gray" },
      { text: "✔", color: "#28FFBF" },
      { text: "]", color: "gray" },
      "有効"
    ]);
    expect(output["text.owo.itemGroup.tab_template"]).toBeUndefined();
    expect(() => applyStructuredJsonTranslations(source, {})).toThrow("Missing structured language translation");
  });
});
