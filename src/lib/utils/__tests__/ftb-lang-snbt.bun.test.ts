import { describe, it, expect } from "bun:test";
import {
  parseFtbQuestLang,
  ftbQuestLangToMap,
  mapToFtbQuestLang,
  isFtbConsolidatedLangPath,
  isFtbQuestLangSourcePath,
  getFtbQuestLangOutputPath,
  validateFtbQuestLangTranslation,
} from "../ftb-lang-snbt";

// A small but representative slice of a real ATM10 (MC 1.21) consolidated
// `config/ftbquests/quests/lang/en_us.snbt` file. Covers: bare strings, single
// element arrays, multi-line arrays, `&` colour codes, `\\n` newline markers
// and `{image:...}` tokens.
const SAMPLE = `{
	chapter.007B547630FF0478.title: "Theurgy"
	chapter.3DEB33F78398EAD6.chapter_subtitle: ["And LaserIO"]
	quest.00075A5F9AC120ED.quest_subtitle: "Always Required"
	quest.00075A5F9AC120ED.quest_desc: ["This will take the items out of your input chest."]
	quest.000C1ECD781F3F81.quest_desc: ["&2&lNature&r is made for using the Earth. \\\\n&2Focus Material&r is &2Poisonous Potato&r."]
	quest.000C1ECD781F3F81.title: "&2&lNature"
	quest.002163B909070CF8.quest_desc: [
		"Allows you to see details about certain blocks.\\\\n"
		"{image:atm:textures/questpics/block_tracker.png width:150 height:150 align:center}"
	]
	quest.002163B909070CF8.quest_subtitle: "Max: 1"
}`;

describe("isFtbConsolidatedLangPath", () => {
  it("matches the 1.21 consolidated lang path", () => {
    expect(
      isFtbConsolidatedLangPath(
        "/home/user/.minecraft/config/ftbquests/quests/lang/en_us.snbt",
      ),
    ).toBe(true);
  });

  it("matches Windows-style paths and any language code", () => {
    expect(
      isFtbConsolidatedLangPath(
        "C:\\Instances\\ATM10\\config\\ftbquests\\quests\\lang\\ja_jp.snbt",
      ),
    ).toBe(true);
  });

  it("does not match per-quest chapter files", () => {
    expect(
      isFtbConsolidatedLangPath(
        "/mc/config/ftbquests/quests/chapters/getting_started.snbt",
      ),
    ).toBe(false);
  });

  it("does not match unrelated snbt files", () => {
    expect(isFtbConsolidatedLangPath("/mc/config/other/en_us.snbt")).toBe(false);
  });
});

describe("FTB Quests language source paths", () => {
  it("selects only English consolidated and Lang Splitter files", () => {
    expect(isFtbQuestLangSourcePath("/pack/config/ftbquests/quests/lang/en_us.snbt")).toBe(true);
    expect(isFtbQuestLangSourcePath("/pack/config/ftbquests/quests/lang/en_us/chapters/start.snbt")).toBe(true);
    expect(isFtbQuestLangSourcePath("/pack/config/ftbquests/quests/lang/en_us/chapters/start.snbt_merged")).toBe(true);
    expect(isFtbQuestLangSourcePath("/pack/config/ftbquests/quests/lang/ja_jp.snbt")).toBe(false);
    expect(isFtbQuestLangSourcePath("/pack/config/ftbquests/quests/chapters/start.snbt")).toBe(false);
  });

  it("writes consolidated output beside the English source", () => {
    expect(getFtbQuestLangOutputPath(
      "C:\\Instances\\ATM10\\config\\ftbquests\\quests\\lang\\en_us.snbt",
      "ja_jp",
    )).toBe("C:\\Instances\\ATM10\\config\\ftbquests\\quests\\lang\\ja_jp.snbt");
  });

  it("mirrors split output under the target locale as an active SNBT file", () => {
    expect(getFtbQuestLangOutputPath(
      "/pack/config/ftbquests/quests/lang/en_us/chapters/start.snbt_merged",
      "ja_jp",
    )).toBe("/pack/config/ftbquests/quests/lang/ja_jp/chapters/start.snbt");
    expect(getFtbQuestLangOutputPath(
      "/pack/config/ftbquests/quests/lang/ja_jp.snbt",
      "fr_fr",
    )).toBeNull();
    expect(getFtbQuestLangOutputPath(
      "/pack/config/ftbquests/quests/lang/en_us.snbt",
      "../../outside",
    )).toBeNull();
  });
});

describe("parseFtbQuestLang", () => {
  it("parses bare string entries", () => {
    const entries = parseFtbQuestLang(SAMPLE);
    const title = entries.find((e) => e.key === "chapter.007B547630FF0478.title");
    expect(title).toBeDefined();
    expect(title!.isArray).toBe(false);
    expect(title!.values).toEqual(["Theurgy"]);
  });

  it("parses single-element array entries", () => {
    const entries = parseFtbQuestLang(SAMPLE);
    const subtitle = entries.find(
      (e) => e.key === "chapter.3DEB33F78398EAD6.chapter_subtitle",
    );
    expect(subtitle!.isArray).toBe(true);
    expect(subtitle!.values).toEqual(["And LaserIO"]);
  });

  it("parses multi-line array entries preserving markup verbatim", () => {
    const entries = parseFtbQuestLang(SAMPLE);
    const desc = entries.find(
      (e) => e.key === "quest.002163B909070CF8.quest_desc",
    );
    expect(desc!.isArray).toBe(true);
    expect(desc!.values).toHaveLength(2);
    // The `\\n` newline marker is preserved verbatim (raw, still escaped).
    expect(desc!.values[0]).toBe(
      "Allows you to see details about certain blocks.\\\\n",
    );
    expect(desc!.values[1]).toContain("{image:atm:textures/");
  });

  it("preserves `&` colour codes and embedded newline markers", () => {
    const entries = parseFtbQuestLang(SAMPLE);
    const desc = entries.find(
      (e) => e.key === "quest.000C1ECD781F3F81.quest_desc",
    );
    expect(desc!.values[0]).toContain("&2&lNature&r");
    expect(desc!.values[0]).toContain("\\\\n");
  });

  it("parses every entry in the sample", () => {
    const entries = parseFtbQuestLang(SAMPLE);
    expect(entries).toHaveLength(8);
  });

  it("fails closed for malformed or non-string lang SNBT", () => {
    expect(() => parseFtbQuestLang('{ quest.title: "unterminated"')).toThrow(/unterminated outer compound/);
    expect(() => parseFtbQuestLang('{ quest.title: 42 }')).toThrow(/expected a string/);
    expect(() => parseFtbQuestLang('{ quest.title: "one" quest.title: "two" }')).toThrow(/duplicate key/);
  });
});

describe("ftbQuestLangToMap", () => {
  it("maps bare strings by their lang key", () => {
    const map = ftbQuestLangToMap(parseFtbQuestLang(SAMPLE));
    expect(map["chapter.007B547630FF0478.title"]).toBe("Theurgy");
    expect(map["quest.00075A5F9AC120ED.quest_subtitle"]).toBe("Always Required");
  });

  it("maps array elements with an [index] suffix", () => {
    const map = ftbQuestLangToMap(parseFtbQuestLang(SAMPLE));
    expect(map["quest.002163B909070CF8.quest_desc[0]"]).toBe(
      "Allows you to see details about certain blocks.\\\\n",
    );
    expect(map["quest.002163B909070CF8.quest_desc[1]"]).toContain("{image:");
  });
});

describe("mapToFtbQuestLang round-trip", () => {
  it("round-trips structure when no translation is applied", () => {
    const entries = parseFtbQuestLang(SAMPLE);
    const map = ftbQuestLangToMap(entries);
    // Re-parse the serialized output and confirm the entries are identical.
    const reparsed = parseFtbQuestLang(mapToFtbQuestLang(entries, map));
    expect(reparsed).toEqual(entries);
  });

  it("substitutes translated values and preserves untranslated ones", () => {
    const entries = parseFtbQuestLang(SAMPLE);
    const translated = {
      "chapter.007B547630FF0478.title": "セレウギア",
      "quest.00075A5F9AC120ED.quest_subtitle": "常に必須",
    };
    const out = mapToFtbQuestLang(entries, translated);
    expect(out).toContain('chapter.007B547630FF0478.title: "セレウギア"');
    expect(out).toContain('quest.00075A5F9AC120ED.quest_subtitle: "常に必須"');
    // Untranslated entries keep their original English text.
    expect(out).toContain('quest.000C1ECD781F3F81.title: "&2&lNature"');
  });

  it("preserves escaped markup through a translate + re-parse cycle", () => {
    const entries = parseFtbQuestLang(SAMPLE);
    const map = ftbQuestLangToMap(entries);
    // Simulate the translation pipeline returning the same keys.
    const reparsed = parseFtbQuestLang(mapToFtbQuestLang(entries, map));
    const desc = reparsed.find(
      (e) => e.key === "quest.002163B909070CF8.quest_desc",
    );
    expect(desc!.values[0]).toBe(
      "Allows you to see details about certain blocks.\\\\n",
    );
  });

  it("produces valid SNBT that starts and ends with braces", () => {
    const entries = parseFtbQuestLang(SAMPLE);
    const out = mapToFtbQuestLang(entries, {});
    expect(out.trimStart().startsWith("{")).toBe(true);
    expect(out.trimEnd().endsWith("}")).toBe(true);
  });

  it("escapes model-produced quotes and literal control characters", () => {
    const entries = parseFtbQuestLang(`{ quest.example.title: "Original" }`);
    const out = mapToFtbQuestLang(entries, {
      "quest.example.title": 'A "quoted" title\nsecond line',
    });
    const reparsed = parseFtbQuestLang(out);

    expect(out).toContain('"A \\\"quoted\\\" title\\nsecond line"');
    expect(reparsed).toHaveLength(1);
    expect(reparsed[0].key).toBe("quest.example.title");
  });

  it("rejects missing or unexpected response keys before writing", () => {
    const entries = parseFtbQuestLang(SAMPLE);
    expect(() => validateFtbQuestLangTranslation(entries, {})).toThrow(/key mismatch/);
    expect(() => validateFtbQuestLangTranslation(entries, {
      ...ftbQuestLangToMap(entries),
      "quest.unexpected.title": "unexpected",
    })).toThrow(/key mismatch/);
    expect(() => validateFtbQuestLangTranslation(entries, ftbQuestLangToMap(entries))).not.toThrow();
  });
});
