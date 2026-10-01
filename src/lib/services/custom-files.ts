/** FTB quest sources have a dedicated parser and translation tab. */
export function isFtbQuestSourcePath(filePath: string): boolean {
  const segments = filePath.replace(/\\/g, "/").toLowerCase().split("/");
  return segments.some((segment, index) =>
    segment === "config"
      && segments[index + 1] === "ftbquests"
      && segments[index + 2] === "quests"
  );
}
