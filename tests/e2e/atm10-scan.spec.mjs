import assert from "node:assert/strict";

const categories = [
  { tab: ["Mods", "Mod"], scan: ["Scan Mods", "Modをスキャン"] },
  { tab: ["Quests", "クエスト"], scan: ["Scan Quests", "クエストをスキャン"] },
  { tab: ["Guidebooks", "ガイドブック"], scan: ["Scan Guidebooks", "ガイドブックをスキャン"] },
  { tab: ["Custom Files", "カスタムファイル"], scan: ["Scan Files", "ファイルをスキャン"] },
];

async function visibleElementContaining(selector, labels) {
  for (const element of await $$(selector)) {
    if (!(await element.isDisplayed())) continue;
    const text = (await element.getText()).trim();
    if (labels.some((label) => text.includes(label))) return element;
  }
  throw new Error(`Could not find visible ${selector} containing: ${labels.join(" / ")}`);
}

async function tableRowMatching(pattern) {
  for (const row of await $$("tbody tr")) {
    if (pattern.test(await row.getText())) return row;
  }
}

async function clickElement(element) {
  await browser.execute((target) => {
    target.scrollIntoView({ block: "center", inline: "nearest" });
    target.click();
  }, element);
}

async function clickCheckbox(checkbox) {
  await clickElement(checkbox);
}

async function clearSelectedTargets() {
  const selectAll = await $("thead [role=checkbox]");
  await clickCheckbox(selectAll);
  await clickCheckbox(selectAll);
}

async function dismissUpdatePromptIfPresent() {
  const dialogs = await $$('[role="dialog"]');
  for (const dialog of dialogs) {
    if (!(await dialog.isDisplayed())) continue;
    for (const button of await dialog.$$('button')) {
      const text = (await button.getText()).trim();
      if (text.includes("Remind Me Later") || text.includes("後で通知")) {
        await button.click();
        return;
      }
    }
  }
}

async function verifyExistingModSkipAndOptIn() {
  await $("#lang-select-tabs-targetLanguage").click();
  await (await visibleElementContaining('[role="option"]', ["日本語 (ja_jp)"])).click();

  const silentGear = await tableRowMatching(/silent[\s_-]*gear/i);
  assert.ok(silentGear, "ATM10 SKY should include Silent Gear in the mod scan");
  const rowText = await silentGear.getText();
  assert.match(rowText, /ja_jp/i, "Silent Gear's existing Japanese locale should be surfaced");

  const rowCheckboxes = await silentGear.$$('[role="checkbox"]');
  assert.ok(rowCheckboxes.length >= 2, "existing-language mods should expose an opt-in retranslation checkbox");

  await clearSelectedTargets();
  const selectedMod = await tableRowMatching(/silent[\s_-]*gear/i);
  assert.ok(selectedMod, "Silent Gear should remain visible after selection updates");
  const selectedModCheckboxes = await selectedMod.$$('[role="checkbox"]');
  assert.equal(await selectedModCheckboxes[0].getAttribute("aria-checked"), "false");
  await clickCheckbox(selectedModCheckboxes[0]);
  assert.equal(await selectedModCheckboxes[0].getAttribute("aria-checked"), "true");
  const selectedRows = [];
  for (const row of await $$("tbody tr")) {
    const [selection] = await row.$$('[role="checkbox"]');
    if (selection && (await selection.getAttribute("aria-checked")) === "true") {
      selectedRows.push(row);
    }
  }
  assert.equal(selectedRows.length, 1, "selecting one mod must not select other mods that share an unknown ID");
  assert.match(await selectedRows[0].getText(), /silent[\s_-]*gear/i);

  await clickElement(await visibleElementContaining("button", ["Translate", "翻訳"]));
  await browser.waitUntil(async () => /Every selected target already contains|選択した対象はすべて|No mods selected|翻訳するModが選択されていません|No target language|対象言語が選択されていません|No API key|APIキーが設定されておらず/.test(await (await $("body")).getText()), {
    timeout: 15_000,
    timeoutMsg: "an existing Japanese mod should be skipped before API-key validation",
  });
  const resultText = await (await $("body")).getText();
  assert.match(resultText, /Every selected target already contains|選択した対象はすべて/, `unexpected result after selecting existing locale: ${resultText}`);

  const retranslateCheckbox = (await selectedMod.$$('[role="checkbox"]'))[1];
  assert.notEqual(await retranslateCheckbox.getAttribute("aria-checked"), "true");
  await clickCheckbox(retranslateCheckbox);
  assert.equal(await retranslateCheckbox.getAttribute("aria-checked"), "true");
  await browser.keys("Escape");
  }

describe("ATM10 SKY app scan", () => {
  before(async () => {
    // This app has a single Tauri window. Explicitly pin the WebDriver handle so
    // the service does not need its optional window-state plugin on every command.
    await browser.switchToWindow(await browser.getWindowHandle());
  });

  it("scans Mods, FTB/KubeJS quests, Patchouli guidebooks, and Custom files in the real Tauri app", async () => {
    await browser.waitUntil(async () => await $("body").isDisplayed(), {
      timeout: 120_000,
      timeoutMsg: "Tauri app window did not become available",
    });
    await dismissUpdatePromptIfPresent();

    const initialText = await (await $("body")).getText();
    assert.match(initialText, /ATM10SKY/, "saved ATM10 SKY profile should be selected automatically");

    const counts = {};
    for (const category of categories) {
      await browser.execute(() => window.scrollTo(0, 0));
      const tab = await visibleElementContaining('[role="tab"]', category.tab);
      await tab.click();
      const scanButton = await visibleElementContaining("button", category.scan);
      assert.equal(await scanButton.isEnabled(), true, `${category.tab[0]} scan should have the saved profile path`);
      await scanButton.click();

      await browser.waitUntil(async () => {
        const button = await visibleElementContaining("button", category.scan);
        return !/scanning|スキャン中/i.test(await button.getText());
      }, {
        timeout: 300_000,
        timeoutMsg: `${category.tab[0]} scan did not finish`,
      });
      await dismissUpdatePromptIfPresent();

      if (category.tab[0] === "Mods") await verifyExistingModSkipAndOptIn();

      const visibleRows = [];
      for (const row of await $$("tbody tr")) {
        if (await row.isDisplayed()) visibleRows.push((await row.getText()).trim());
      }
      const empty = visibleRows.some((text) => /No (mods|quests|guidebooks) found|見つかりません/.test(text));
      counts[category.tab[0]] = empty ? 0 : visibleRows.length;
      console.log(`${category.tab[0]} targets: ${counts[category.tab[0]]}`);
    }

    assert.ok(counts.Mods > 0, "ATM10 SKY should expose eligible mod language files");
    assert.ok(counts.Quests > 0, "ATM10 SKY should expose FTB/KubeJS quest translation sources");
    assert.ok(counts.Guidebooks > 0, "ATM10 SKY should expose Patchouli guidebooks");
    assert.ok(counts["Custom Files"] > 0, "ATM10 SKY profile directory should expose custom JSON/SNBT files");
  });

  it("skips an existing Japanese quest output before API-key validation", async () => {
    const questsTab = await visibleElementContaining('[role="tab"]', ["Quests", "クエスト"]);
    await questsTab.click();

    await $("#lang-select-tabs-targetLanguage").click();
    await (await visibleElementContaining('[role="option"]', ["日本語 (ja_jp)"])).click();

    const scanButton = await visibleElementContaining("button", ["Scan Quests", "クエストをスキャン"]);
    await scanButton.click();
    await browser.waitUntil(async () => !/scanning|スキャン中/i.test(await scanButton.getText()), {
      timeout: 300_000,
      timeoutMsg: "quest scan did not finish",
    });

    const existingQuest = await tableRowMatching(/chapter_group\.snbt/i);
    assert.ok(existingQuest, "ATM10 SKY should expose the existing FTB Japanese output source");
    await clearSelectedTargets();
    const questCheckbox = (await existingQuest.$$('[role="checkbox"]'))[0];
    await clickCheckbox(questCheckbox);
    await clickElement(await visibleElementContaining("button", ["Translate", "翻訳"]));

    await browser.waitUntil(async () => /Every selected target already contains|選択した対象はすべて/.test(await (await $("body")).getText()), {
      timeout: 15_000,
      timeoutMsg: "existing Japanese quest output should be skipped before checking the API key",
    });
    await browser.keys("Escape");
  });

  it("skips Patchouli books that already contain Japanese inside their JAR", async () => {
    const guidebooksTab = await visibleElementContaining('[role="tab"]', ["Guidebooks", "ガイドブック"]);
    await guidebooksTab.click();

    await $("#lang-select-tabs-targetLanguage").click();
    await (await visibleElementContaining('[role="option"]', ["日本語 (ja_jp)"])).click();

    const scanButton = await visibleElementContaining("button", ["Scan Guidebooks", "ガイドブックをスキャン"]);
    await scanButton.click();
    await browser.waitUntil(async () => {
      const button = await visibleElementContaining("button", ["Scan Guidebooks", "ガイドブックをスキャン"]);
      return !/scanning|スキャン中/i.test(await button.getText());
    }, {
      timeout: 300_000,
      timeoutMsg: "guidebook scan did not finish",
    });

    const existingBook = await tableRowMatching(/allthemodium/i);
    assert.ok(existingBook, "ATM10 SKY should include an existing Japanese Patchouli book");
    await clearSelectedTargets();
    const [selection] = await existingBook.$$('[role="checkbox"]');
    if (await selection.getAttribute("aria-checked") !== "true") await clickCheckbox(selection);
    await clickElement(await visibleElementContaining("button", ["Translate", "翻訳"]));

    await browser.waitUntil(async () => /Every selected target already contains|選択した対象はすべて/.test(await (await $("body")).getText()), {
      timeout: 15_000,
      timeoutMsg: "existing Japanese Patchouli book should be skipped before checking the API key",
    });
  });
});
