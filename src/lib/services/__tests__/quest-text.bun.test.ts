import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  applyBetterQuestJsonTranslations,
  applyJavaLangTranslations,
  applyJsonLangTranslations,
  applyQuestTranslations,
  extractBetterQuestJsonText,
  extractJavaLangText,
  extractJsonLangText,
  extractQuestText,
  filterExistingQuestTranslations,
  getUntranslatedEnglishQuestKeys,
  getDirectQuestBackupPath,
  getQuestOutputPath,
  getQuestSourceCacheKey,
  isDirectQuestSource
} from "../quest-text";
import { type QuestTextBundle } from "../quest-text";

// Minimal mock files mirror the on-disk layouts found in ATM9, ATM10 SKY, Create: Astral, and BetterQuesting.
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

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
  test("detects long untranslated English quest prose but not localized text or short names", () => {
    const sourceBundle = {
      content: {
        prose: "The Enrichment Chamber will process the items placed inside it and produce improved materials for the player to use in later recipes.",
        name: "Mekanism",
        translated: "A new machine",
        image: "{image:atm:textures/questpics/mek/mek_sps1.png width:100 height:90 align:center}",
      },
      spans: [],
    };
    const localizedBundle = {
      content: {
        prose: sourceBundle.content.prose,
        name: sourceBundle.content.name,
        translated: "新しい機械",
        image: sourceBundle.content.image,
      },
      spans: [],
    };

    expect(getUntranslatedEnglishQuestKeys(sourceBundle, localizedBundle)).toEqual(["prose"]);
  });

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
    expect(bundle.spans.map((span) => span.sourceKey)).toEqual([
      "chapter.123.title",
      "chapter.123.chapter_subtitle#0",
      "quest.456.description#0"
    ]);
    expect(applyQuestTranslations(
      localizedSource,
      bundle,
      Object.fromEntries(Object.keys(bundle.content).map((key) => [key, "日本語"]))
    )).toContain('chapter.123.title: "日本語"');
  });

  test("translates legacy quest text embedded in SNBT and preserves quest structure", () => {
    const source = fixture("ftb-inline-1.20.snbt");
    const bundle = extractQuestText(source);
    expect(Object.values(bundle.content)).toEqual([
      "&6Welcome to the Sky", "Gather some wood", "Then build a safe platform",
      'Keep "quotes" and : separators', "Use \n for a line break",
      "Make andesite alloy", "Use &l&62 andesite&r and iron nuggets"
    ]);
    const translated = Object.fromEntries(Object.keys(bundle.content).map((key) => [key, `訳:${key}`]));
    translated["quest.text.3"] = '「引用符」\n次の行';
    const result = applyQuestTranslations(source, bundle, translated);
    expect(result).toContain('id: "2771124207DF211A"');
    expect(result).toContain('quest: { id: "310969B8FE0A94DE", title: "訳:quest.text.5"');
    expect(result).toContain(`description: ["訳:quest.text.1", "訳:quest.text.2", "「引用符」\\n次の行", "訳:quest.text.4"]`);
    expect(extractQuestText(result).content["quest.text.3"]).toBe('「引用符」\n次の行');
  });

  test("extracts flat 1.21 locale SNBT keys including quest_subtitle and quest_desc", () => {
    const source = fixture("ftb-flat-en_us.snbt");
    const bundle = extractQuestText(source);
    expect(Object.values(bundle.content)).toEqual([
      "&fFood and Farming", "And Other Spawners", "A Fresh Start", "The first steps",
      "Place an Obsidian Nest", "Then return to the quest book", "Collect a sapling"
    ]);
    expect(bundle.spans.map((span) => span.sourceKey)).toEqual([
      "chapter.05E614FDA677D85E.title",
      "chapter.0E81CBCD6B1D1895.chapter_subtitle#0",
      "quest.00FD36C207845895.title",
      "quest.00FD36C207845895.quest_subtitle",
      "quest.00FD36C207845895.quest_desc#0",
      "quest.00FD36C207845895.quest_desc#1",
      "task.1234567890ABCDEF.title"
    ]);
    const translated = Object.fromEntries(Object.keys(bundle.content).map((key) => [key, `訳:${key}`]));
    const result = applyQuestTranslations(source, bundle, translated);
    expect(result).toContain('quest.00FD36C207845895.quest_desc: ["訳:quest.text.4", "訳:quest.text.5"]');
    expect(result).toContain('quest.00FD36C207845895.quest_subtitle: "訳:quest.text.3"');
    expect(result).toContain('chapter.05E614FDA677D85E.title: "訳:quest.text.0"');
  });

  test("extracts and replaces text in split and merged FTB SNBT samples", () => {
    for (const name of ["ftb-split-chapter.snbt", "ftb-split-chapter.snbt_merged"]) {
      const source = fixture(name);
      const bundle = extractQuestText(source);
      expect(Object.keys(bundle.content).length).toBeGreaterThan(0);
      const translated = Object.fromEntries(Object.keys(bundle.content).map((key) => [key, `訳:${key}`]));
      const output = applyQuestTranslations(source, bundle, translated);
      expect(output).toContain("chapter.05E614FDA677D85E.title");
      expect(extractQuestText(output).spans.map((span) => span.sourceKey)).toEqual(bundle.spans.map((span) => span.sourceKey));
    }
  });
});

describe("KubeJS language JSON translation", () => {
  test("translates string values and preserves keys and non-string metadata", () => {
    const source = '{\n  "item.example": "Copper Pickaxe",\n  "metadata": 7\n}\n';
    const entries = extractJsonLangText(source);
    expect(entries).toEqual({ "item.example": "Copper Pickaxe" });
    const result = JSON.parse(applyJsonLangTranslations(source, { "item.example": "銅のツルハシ" }));
    expect(result).toEqual({ "item.example": "銅のツルハシ", metadata: 7 });
  });

  test("rejects a changed key set", () => {
    expect(() => applyJsonLangTranslations('{"key":"value"}', { other: "別" })).toThrow(/missing: key; extra: other/);
  });

  test("translates Create Astral-style namespace locale JSON and preserves metadata", () => {
    const source = fixture("createastral-en_us.json");
    const entries = extractJsonLangText(source);
    expect(entries).toEqual({
      "custommachinery.astralgenerators.assembler": "Assembler",
      "createastral.quest.welcome": "Welcome to the Astral world"
    });
    const result = JSON.parse(applyJsonLangTranslations(source, {
      "custommachinery.astralgenerators.assembler": "組立機",
      "createastral.quest.welcome": "星界へようこそ"
    }));
    expect(result.comment_1).toBe("custommachinery");
    expect(result["createastral.quest.welcome"]).toBe("星界へようこそ");
  });
});

describe("legacy Java .lang properties", () => {
  test("translates values while keeping comments, keys, and property escapes intact", () => {
    const source = fixture("betterquesting-DefaultQuests.lang");
    const bundle = extractJavaLangText(source);
    expect(bundle.content).toEqual({
      "quest.welcome": "Welcome to the quest book",
      "quest.description": "Gather\nmaterials and return",
      "quest.escaped=key": "Use a \\ before the equals sign",
      "quest.unicode": "А potion"
    });
    const translated = {
      "quest.welcome": "クエストブックへようこそ",
      "quest.description": "素材を集めて\\n戻ってきてください",
      "quest.escaped=key": "等号キーを保持",
      "quest.unicode": "ポーション"
    };
    const result = applyJavaLangTranslations(source, bundle, translated);
    expect(result).toContain("# direct default quest language data");
    expect(result).toContain("quest.escaped\\=key=等号キーを保持");
    expect(result).toContain("quest.description=素材を集めて\\\\n戻ってきてください");
    expect(extractJavaLangText(result).content).toEqual(translated);
  });

  test("supports Java properties continuation lines and validates the key set", () => {
    const source = "line=first\\\n  second\nother=value\n";
    const bundle = extractJavaLangText(source);
    expect(bundle.content).toEqual({ line: "firstsecond", other: "value" });
    const translated = applyJavaLangTranslations(source, bundle, { line: "継続行", other: "別" });
    expect(extractJavaLangText(translated).content).toEqual({ line: "継続行", other: "別" });
    expect(() => applyJavaLangTranslations(source, bundle, { line: "継続行" })).toThrow(/missing: other/);
    expect(() => extractJavaLangText("broken=value\\")).toThrow(/Unterminated/);
  });
});

describe("BetterQuesting default quest data", () => {
  test("translates nested name/description fields while preserving IDs and metadata", () => {
    const source = fixture("betterquesting-DefaultQuests.json");
    const bundle = extractBetterQuestJsonText(source);
    expect(Object.values(bundle.content)).toEqual(["Build a Copper Pickaxe", "Mine copper and make a pickaxe"]);
    const result = JSON.parse(applyBetterQuestJsonTranslations(source, bundle, {
      "quest.text.0": "銅のツルハシを作る",
      "quest.text.1": "銅を採掘してツルハシを作る"
    }));
    expect(result["properties:10"]["betterquesting:10"]["name:8"]).toBe("銅のツルハシを作る");
    expect(result["properties:10"]["betterquesting:10"]["icon:10"]["id:8"]).toBe("minecraft:iron_pickaxe");
    expect(result["questIDLow:4"]).toBe(104);
  });
});

describe("quest translation output paths", () => {
  test("writes KubeJS JSON beside the source under the target locale", () => {
    expect(getQuestOutputPath("C:\\ATM10\\kubejs\\assets\\example\\lang\\en_us.json", "ja_jp"))
      .toBe("C:\\ATM10\\kubejs\\assets\\example\\lang\\ja_jp.json");
  });

  test("writes arbitrary resource namespaces and legacy locale files beside the source", () => {
    expect(getQuestOutputPath("C:\\Astral\\resources\\createastral\\lang\\en_us.json", "ja_jp"))
      .toBe("C:\\Astral\\resources\\createastral\\lang\\ja_jp.json");
    expect(getQuestOutputPath("C:\\Pack\\resources\\betterquesting\\lang\\en_US.lang", "ja_jp"))
      .toBe("C:\\Pack\\resources\\betterquesting\\lang\\ja_jp.lang");
  });

  test("writes localized FTB SNBT under the target-language tree", () => {
    expect(getQuestOutputPath("C:\\ATM10\\config\\ftbquests\\quests\\lang\\en_us\\chapter.snbt", "ja_jp"))
      .toBe("C:\\ATM10\\config\\ftbquests\\quests\\lang\\ja_jp\\chapter.snbt");
  });

  test("preserves merged SNBT paths and maps flat locale files to matching locale filenames", () => {
    expect(getQuestOutputPath("C:\\ATM10\\config\\ftbquests\\quests\\lang\\en_us\\chapters\\main.snbt_merged", "ja_jp"))
      .toBe("C:\\ATM10\\config\\ftbquests\\quests\\lang\\ja_jp\\chapters\\main.snbt_merged");
    expect(getQuestOutputPath("C:\\ATM10\\config\\ftbquests\\quests\\lang\\en_us.snbt", "ja_jp"))
      .toBe("C:\\ATM10\\config\\ftbquests\\quests\\lang\\ja_jp.snbt");
  });

  test("reuses translations for the same FTB field/value across split and flat files", () => {
    expect(getQuestSourceCacheKey("split.snbt", "quest.text.0", "Same", "quest.123.title"))
      .toBe(getQuestSourceCacheKey("flat.snbt", "quest.text.7", "Same", "quest.123.title"));
    expect(getQuestSourceCacheKey("split.snbt", "quest.text.0", "New", "quest.123.title"))
      .not.toBe(getQuestSourceCacheKey("flat.snbt", "quest.text.7", "Same", "quest.123.title"));
    expect(getQuestSourceCacheKey("one.snbt", "quest.text.0", "Same"))
      .not.toBe(getQuestSourceCacheKey("two.snbt", "quest.text.0", "Same"));
  });

  test("routes legacy inline FTB and BetterQuesting source files to explicit in-place output", () => {
    expect(getQuestOutputPath("C:\\ATM10\\config\\ftbquests\\quests\\chapters\\main.snbt", "ja_jp"))
      .toBe("C:\\ATM10\\config\\ftbquests\\quests\\chapters\\main.snbt");
    expect(getQuestOutputPath("C:\\Pack\\config\\ftb_quests\\quests\\chapters\\main.snbt", "ja_jp"))
      .toBe("C:\\Pack\\config\\ftb_quests\\quests\\chapters\\main.snbt");
    const defaultQuests = "C:\\Pack\\config\\betterquesting\\DefaultQuests.lang";
    expect(getQuestOutputPath(defaultQuests, "ja_jp")).toBe(defaultQuests);
    expect(isDirectQuestSource(defaultQuests)).toBe(true);
    expect(isDirectQuestSource("C:\\ATM10\\config\\ftbquests\\quests\\chapters\\main.snbt")).toBe(true);
    expect(getDirectQuestBackupPath(defaultQuests)).toBe(defaultQuests + ".mml-original.bak");
  });

  test("refuses paths that cannot be safely localized", () => {
    expect(() => getQuestOutputPath("C:\\ATM10\\config\\other\\chapter.snbt", "ja_jp"))
      .toThrow("Cannot determine a safe localized output path");
  });

  test("skips existing locale outputs without changing the selected source targets", async () => {
    const targets = [
      { id: "kubejs", path: "C:\\ATM10\\kubejs\\assets\\example\\lang\\en_us.json" },
      { id: "ftb", path: "C:\\ATM10\\config\\ftbquests\\quests\\lang\\en_us\\chapter.snbt" }
    ];
    const existingOutput = "C:\\ATM10\\config\\ftbquests\\quests\\lang\\ja_jp\\chapter.snbt";
    const translated = await filterExistingQuestTranslations(targets, "ja_jp", async (outputPath) => outputPath === existingOutput);

    expect(translated).toEqual([targets[0]]);
  });

  test("does not mistake the original inline quest file for an existing locale output", async () => {
    const target = { id: "legacy", path: "C:\\ATM9\\config\\ftbquests\\quests\\chapters\\main.snbt" };
    const translated = await filterExistingQuestTranslations([target], "ja_jp", async () => true);
    expect(translated).toEqual([target]);
  });
});

describe("offline copied-pack translation round trips", () => {
  test("extracts JSON inputs, applies mock JSON outputs, and writes the right localized or legacy file", () => {
    const snbt = (source: string) => extractQuestText(source);
    const javaLang = (source: string) => extractJavaLangText(source);
    const cases: Array<{
      fixture: string;
      sourceParts: string[];
      extract: (source: string) => Record<string, string>;
      apply: (source: string, translated: Record<string, string>) => string;
      snbt?: boolean;
    }> = [
      {
        fixture: "ftb-flat-en_us.snbt",
        sourceParts: ["config", "ftbquests", "quests", "lang", "en_us.snbt"],
        extract: (source) => snbt(source).content,
        apply: (source, translated) => applyQuestTranslations(source, snbt(source), translated),
        snbt: true
      },
      {
        fixture: "ftb-split-chapter.snbt",
        sourceParts: ["config", "ftbquests", "quests", "lang", "en_us", "chapters", "chapter.snbt"],
        extract: (source) => snbt(source).content,
        apply: (source, translated) => applyQuestTranslations(source, snbt(source), translated),
        snbt: true
      },
      {
        fixture: "ftb-split-chapter.snbt_merged",
        sourceParts: ["config", "ftbquests", "quests", "lang", "en_us", "chapters", "chapter.snbt_merged"],
        extract: (source) => snbt(source).content,
        apply: (source, translated) => applyQuestTranslations(source, snbt(source), translated),
        snbt: true
      },
      {
        fixture: "ftb-inline-1.20.snbt",
        sourceParts: ["config", "ftb_quests", "quests", "chapters", "main.snbt"],
        extract: (source) => snbt(source).content,
        apply: (source, translated) => applyQuestTranslations(source, snbt(source), translated),
        snbt: true
      },
      {
        fixture: "createastral-en_us.json",
        sourceParts: ["resources", "createastral", "lang", "en_us.json"],
        extract: extractJsonLangText,
        apply: applyJsonLangTranslations
      },
      {
        fixture: "betterquesting-DefaultQuests.json",
        sourceParts: ["config", "betterquesting", "DefaultQuests.json"],
        extract: (source) => extractBetterQuestJsonText(source).content,
        apply: (source, translated) => applyBetterQuestJsonTranslations(source, extractBetterQuestJsonText(source), translated)
      },
      {
        fixture: "betterquesting-DefaultQuests.lang",
        sourceParts: ["resources", "legacy_mod", "lang", "en_us.lang"],
        extract: (source) => javaLang(source).content,
        apply: (source, translated) => applyJavaLangTranslations(source, javaLang(source), translated)
      },
      {
        fixture: "betterquesting-DefaultQuests.lang",
        sourceParts: ["config", "betterquesting", "DefaultQuests.lang"],
        extract: (source) => javaLang(source).content,
        apply: (source, translated) => applyJavaLangTranslations(source, javaLang(source), translated)
      }
    ];
    const copyRoot = mkdtempSync(join(tmpdir(), "mml-layout-roundtrip-"));

    try {
      for (const item of cases) {
        const original = fixture(item.fixture);
        const sourcePath = join(copyRoot, ...item.sourceParts);
        mkdirSync(dirname(sourcePath), { recursive: true });
        writeFileSync(sourcePath, original, "utf8");

        const extracted = item.extract(original);
        const requestJson = JSON.stringify(extracted);
        const modelInput = JSON.parse(requestJson) as Record<string, string>;
        const mockResponseJson = JSON.stringify(Object.fromEntries(
          Object.entries(modelInput).map(([key, value]) => [key, `仮訳:${value}`])
        ));
        const translated = JSON.parse(mockResponseJson) as Record<string, string>;
        expect(Object.keys(translated).sort()).toEqual(Object.keys(extracted).sort());

        const output = item.apply(original, translated);
        const outputPath = getQuestOutputPath(sourcePath, "ja_jp");
        if (isDirectQuestSource(sourcePath)) {
          writeFileSync(getDirectQuestBackupPath(sourcePath), original, "utf8");
        } else {
          mkdirSync(dirname(outputPath), { recursive: true });
        }
        writeFileSync(outputPath, output, "utf8");

        const saved = readFileSync(outputPath, "utf8");
        expect(item.extract(saved)).toEqual(translated);
        if (outputPath === sourcePath) {
          expect(readFileSync(getDirectQuestBackupPath(sourcePath), "utf8")).toBe(original);
        } else {
          expect(readFileSync(sourcePath, "utf8")).toBe(original);
        }
        if (item.snbt) {
          const before = extractQuestText(original);
          const after = extractQuestText(saved);
          const maskText = (text: string, bundle: QuestTextBundle) => [...bundle.spans]
            .sort((left, right) => right.start - left.start)
            .reduce((value, span) => value.slice(0, span.start) + "<TEXT>" + value.slice(span.end), text);
          expect(maskText(saved, after)).toBe(maskText(original, before));
        }
      }
    } finally {
      rmSync(copyRoot, { recursive: true, force: true });
    }
  });
});
