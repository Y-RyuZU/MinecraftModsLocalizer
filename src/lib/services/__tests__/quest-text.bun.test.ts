import { describe, expect, test } from "bun:test";
import { applyQuestTranslations, extractQuestText } from "../quest-text";

const source = `{
  title: "Make andesite alloy"
  subtitle: "A useful starting material"
  description: ["Use &l&62 andesite&r&r and iron nuggets", "Keep the quest id:123 intact"]
  id: "2771124207DF211A"
  rewards: [{ item: "create:andesite_alloy" }]
}`;

const localizedSource = `{
  chapter.123.title: "&fChapter One"
  chapter.123.chapter_subtitle: ["And Other Spawners"]
  quest.456.description: ["Mine some iron"]
  quest.456.icon: "minecraft:iron_ingot"
}`;

describe("FTB quest text extraction", () => {
  test("extracts only visible title, subtitle, and description strings", () => {
    const bundle = extractQuestText(source);

    expect(Object.values(bundle.content)).toEqual([
      "Make andesite alloy",
      "A useful starting material",
      "Use &l&62 andesite&r&r and iron nuggets",
      "Keep the quest id:123 intact"
    ]);
    expect(bundle.content).not.toHaveProperty("quest.text.4");
  });

  test("replaces text without changing SNBT fields or structure", () => {
    const bundle = extractQuestText(source);
    const translated = Object.fromEntries(
      Object.keys(bundle.content).map((key) => [key, `訳:${bundle.content[key]}`])
    );

    const result = applyQuestTranslations(source, bundle, translated);

    expect(result).toContain('title: "訳:Make andesite alloy"');
    expect(result).toContain('description: ["訳:Use &l&62 andesite&r&r and iron nuggets", "訳:Keep the quest id:123 intact"]');
    expect(result).toContain('id: "2771124207DF211A"');
    expect(result).toContain('item: "create:andesite_alloy"');
  });

  test("supports modern FTB localized keys with dotted field names", () => {
    const bundle = extractQuestText(localizedSource);

    expect(Object.values(bundle.content)).toEqual([
      "&fChapter One",
      "And Other Spawners",
      "Mine some iron"
    ]);
    expect(applyQuestTranslations(
      localizedSource,
      bundle,
      Object.fromEntries(Object.keys(bundle.content).map((key) => [key, "日本語"]))
    )).toContain('chapter.123.title: "日本語"');
  });
});
