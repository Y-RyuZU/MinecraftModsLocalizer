import { describe, expect, test } from "bun:test";
import { applyCustomJsonTranslations, extractCustomJsonText } from "../custom-json";
import { addToTranslationBatch, createTranslationBatch, restoreBatchedTranslations } from "../translation-batch";

describe("custom JSON translation", () => {
  test("batches string values and preserves keys, arrays, and metadata", () => {
    const source = {
      title: "Copper tools",
      metadata: { id: "example:tools", enabled: true },
      entries: ["Pickaxe", 12, { name: "Shovel" }],
    };
    const bundle = extractCustomJsonText(source);
    const translated = Object.fromEntries(Object.keys(bundle.content).map((key, index) => [key, `ja-${index}`]));

    expect(bundle.content).toEqual({ "custom.text.0": "Copper tools", "custom.text.1": "Pickaxe", "custom.text.2": "Shovel" });
    expect(applyCustomJsonTranslations(source, bundle, translated)).toEqual({
      title: "ja-0",
      metadata: { id: "example:tools", enabled: true },
      entries: ["ja-1", 12, { name: "ja-2" }],
    });
  });

  test("rejects incomplete or extra translation keys", () => {
    const bundle = extractCustomJsonText({ title: "Copper tools" });
    expect(() => applyCustomJsonTranslations({}, bundle, {})).toThrow(/missing/);
    expect(() => applyCustomJsonTranslations({}, bundle, { "custom.text.0": "銅の道具", extra: "余計" })).toThrow(/extra/);
  });

  test("supports a JSON string at the root", () => {
    const bundle = extractCustomJsonText("Copper tools");
    expect(applyCustomJsonTranslations("Copper tools", bundle, { "custom.text.0": "銅の道具" })).toBe("銅の道具");
  });

  test("deduplicates identical strings across files and restores each file's keys", () => {
    const batch = createTranslationBatch();
    const firstSource = { title: "Copper tools", empty: "" };
    const secondSource = { quest: "Copper tools", reward: "Iron ingot" };
    const firstMap = addToTranslationBatch(batch, firstSource);
    const secondMap = addToTranslationBatch(batch, secondSource);
    const translated = { "batch.text.0": "銅の道具", "batch.text.1": "鉄インゴット" };

    expect(Object.keys(batch.content)).toHaveLength(2);
    expect(firstMap.title).toBe(secondMap.quest);
    expect(restoreBatchedTranslations(firstSource, firstMap, translated)).toEqual({ title: "銅の道具", empty: "" });
    expect(restoreBatchedTranslations(secondSource, secondMap, translated)).toEqual({ quest: "銅の道具", reward: "鉄インゴット" });
  });

  test("rejects missing translations while restoring a file", () => {
    const batch = createTranslationBatch();
    const source = { title: "Copper tools" };
    const mapping = addToTranslationBatch(batch, source);
    expect(() => restoreBatchedTranslations(source, mapping, {})).toThrow(/Missing batched translation/);
  });
});
