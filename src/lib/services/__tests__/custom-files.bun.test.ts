import { describe, expect, test } from "bun:test";
import { isFtbQuestSourcePath } from "../custom-files";

describe("custom file source filtering", () => {
  test("recognizes FTB quest files in Windows and POSIX paths", () => {
    expect(isFtbQuestSourcePath("C:\\Prism\\ATM10\\minecraft\\config\\ftbquests\\quests\\lang\\en_us.snbt")).toBe(true);
    expect(isFtbQuestSourcePath("/game/config/ftbquests/quests/chapters/start.snbt")).toBe(true);
    expect(isFtbQuestSourcePath("/game/CONFIG/FTBQUESTS/QUESTS/chapters/start.snbt")).toBe(true);
  });

  test("keeps unrelated custom SNBT files eligible", () => {
    expect(isFtbQuestSourcePath("C:\\game\\config\\othermod\\quests.snbt")).toBe(false);
    expect(isFtbQuestSourcePath("/custom/quests/chapter.snbt")).toBe(false);
  });
});
