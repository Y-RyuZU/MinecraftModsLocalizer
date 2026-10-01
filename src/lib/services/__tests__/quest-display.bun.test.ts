import { expect, test } from "bun:test";
import { getQuestDisplayName } from "../quest-display";
import { getRelativePath } from "../../utils/path-utils";

test("chapter names omit paths, type labels and nested quest titles", async () => {
  const path = "C:\\Pack\\config\\ftbquests\\quests\\chapters\\start.snbt";
  expect(await getQuestDisplayName(path, async () => '{ quests: [{title: "Nested"}] title: "&aStarting Out" }')).toBe("Starting Out");
  expect(await getQuestDisplayName(path, async () => { throw Error("unreadable"); })).toBe("start");
});

test("split language chapters use their chapter ID to find the title", async () => {
  const files: Record<string, string> = {
    "/pack/config/ftbquests/quests/chapters/start.snbt": '{icon: {id: "minecraft:stone"} id: "ABC"}',
    "/pack/config/ftbquests/quests/lang/en_us/chapter.snbt": '{ chapter.ABC.title: "&fFirst Steps" }',
  };
  expect(await getQuestDisplayName("/pack/config/ftbquests/quests/lang/en_us/chapters/start.snbt", async p => {
    if (!(p in files)) throw Error("missing");
    return files[p];
  })).toBe("First Steps");
  expect(await getQuestDisplayName("/pack/lang/en_us.snbt", async () => "{}")).toBe("en_us");
});

test("Windows canonical paths keep enough relative path to distinguish source files", () => {
  expect(getRelativePath("\\\\?\\C:\\Pack\\config\\ftbquests\\quests\\lang\\en_us\\chapters\\start.snbt", "C:\\Pack"))
    .toBe("config/ftbquests/quests/lang/en_us/chapters/start.snbt");
  expect(getRelativePath("\\\\?\\UNC\\server\\pack\\config\\file.snbt", "\\\\server\\pack"))
    .toBe("config/file.snbt");
});
