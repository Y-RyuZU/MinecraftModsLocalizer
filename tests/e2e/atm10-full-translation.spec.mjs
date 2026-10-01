import assert from "node:assert/strict";

const categories = [
  { tab: ["Mods", "Mod"], scan: ["Scan Mods", "Modをスキャン"], label: "Mods" },
  { tab: ["Quests", "クエスト"], scan: ["Scan Quests", "クエストをスキャン"], label: "Quests" },
  { tab: ["Guidebooks", "ガイドブック"], scan: ["Scan Guidebooks", "ガイドブックをスキャン"], label: "Guidebooks" },
  { tab: ["Custom Files", "カスタムファイル"], scan: ["Scan Files", "ファイルをスキャン"], label: "Custom Files" },
];
const requestedCategories = process.env.MML_CATEGORIES
  ? new Set(process.env.MML_CATEGORIES.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean))
  : null;
const activeCategories = requestedCategories
  ? categories.filter((category) => requestedCategories.has(category.label.toLowerCase()))
  : categories;
const scanOnly = process.env.MML_SCAN_ONLY !== "0";
if (activeCategories.length === 0) throw new Error("MML_CATEGORIES did not match a translation category");

async function clickElement(element) {
  await element.scrollIntoView({ block: "center", inline: "nearest" });
  await element.click();
}

async function setInputValue(element, value) {
  await element.scrollIntoView({ block: "center", inline: "nearest" });
  await element.setValue(String(value));
}

async function visibleElementContaining(selector, labels) {
  for (const element of await $$(selector)) {
    if (!(await element.isDisplayed())) continue;
    const text = (await element.getText()).trim();
    if (labels.some((label) => text.includes(label))) return element;
  }
  throw new Error(`Could not find visible ${selector} containing: ${labels.join(" / ")}`);
}

async function visibleTranslationError() {
  for (const element of await $$('[class*="text-destructive"]')) {
    if (await element.isDisplayed()) return (await element.getText()).trim();
  }
  return "";
}

async function dismissUpdatePromptIfPresent() {
  for (const dialog of await $$('[role="dialog"]')) {
    if (!(await dialog.isDisplayed())) continue;
    for (const button of await dialog.$$('button')) {
      if (/Remind Me Later|後で通知/.test(await button.getText())) {
        await clickElement(button);
        return;
      }
    }
  }
}

async function selectJapanese() {
  await clickElement($("#lang-select-tabs-targetLanguage"));
  await clickElement(await visibleElementContaining('[role="option"]', ["日本語 (ja_jp)"]));
}

async function selectAllRows(skipModIds = new Set()) {
  const rows = await $$("tbody tr");
  assert.ok(rows.length > 0, "the scan should return rows before selecting targets");

  const header = await $("thead [role=checkbox]");
  if ((await header.getAttribute("aria-checked")) === "true") await clickElement(header);
  await clickElement(header);
  const skippedModIds = new Set();
  for (const row of rows) {
    const cells = await row.$$("td");
    const modId = cells.length >= 3 ? (await cells[2].getText()).trim() : "";
    if (!skipModIds.has(modId)) continue;
    const [selection] = await row.$$('[role="checkbox"]');
    if (selection && (await selection.getAttribute("aria-checked")) === "true") {
      await clickElement(selection);
      skippedModIds.add(modId);
    }
  }

  await browser.waitUntil(async () => {
    const state = await browser.execute((skippedIds) => {
      const currentRows = [...document.querySelectorAll("tbody tr")];
      const shouldSelect = (row) => {
        const modId = row.querySelectorAll("td")[2]?.textContent?.trim() ?? "";
        return !skippedIds.includes(modId);
      };
      const selectedCount = currentRows.filter((row) =>
        row.querySelector('[role="checkbox"]')?.getAttribute("aria-checked") === "true"
      ).length;
      const expectedCount = currentRows.filter(shouldSelect).length;
      return { rowCount: currentRows.length, selectedCount, expectedCount };
    }, [...skipModIds]);
    return state.rowCount === rows.length && state.selectedCount === state.expectedCount;
  }, { timeout: 15_000, timeoutMsg: "select-all did not select every scanned row" });
  return { total: rows.length, skipped: skippedModIds.size, selected: rows.length - skippedModIds.size };
}

async function optInForcedTranslations(forceModIds, skipModIds) {
  const remaining = new Set([...forceModIds].filter((modId) => !skipModIds.has(modId)));
  for (const row of await $$("tbody tr")) {
    const cells = await row.$$("td");
    const modId = cells.length >= 3 ? (await cells[2].getText()).trim() : "";
    if (!remaining.has(modId)) continue;
    const checkboxes = await row.$$('[role="checkbox"]');
    if (checkboxes.length >= 2 && (await checkboxes[1].getAttribute("aria-checked")) !== "true") {
      await clickElement(await row.$("label"));
      await browser.waitUntil(async () => (await checkboxes[1].getAttribute("aria-checked")) === "true", {
        timeout: 5_000,
        timeoutMsg: `${modId} force-translation opt-in did not activate`,
      });
    }
    remaining.delete(modId);
  }
  assert.equal(remaining.size, 0, `force-translation targets were not exposed: ${[...remaining].join(", ")}`);
}

async function configureBatchSizes(size, questSize) {
  const numericInputs = await $$('[role="dialog"] input[type="number"]');
  assert.ok(numericInputs.length >= 5, "settings should expose retries, temperature, and three translation chunk sizes");
  const sizes = [size, questSize, size].map(String);
  for (const [index, input] of numericInputs.slice(-3).entries()) {
    await setInputValue(input, sizes[index]);
  }
  assert.deepEqual(await Promise.all(numericInputs.slice(-3).map((input) => input.getValue())), sizes);
}

describe("ATM10 SKY complete translation", () => {
  before(async () => {
    await browser.switchToWindow(await browser.getWindowHandle());
    await browser.waitUntil(async () => await $("body").isDisplayed(), {
      timeout: 120_000,
      timeoutMsg: "Tauri app window did not become available",
    });
    await dismissUpdatePromptIfPresent();
    assert.match(await (await $("body")).getText(), /ATM10SKY/, "saved ATM10 SKY profile should be selected");
  });

  it("translates all eligible targets with the injected OpenAI key", async function () {
    this.timeout(24 * 60 * 60 * 1000);

    if (!scanOnly) {
    await clickElement(await $("button[aria-label='設定'], button[aria-label='Settings']"));
    await $('[role="dialog"]').waitForDisplayed();
    const provider = await $('[role="dialog"] [role="combobox"]');
    if (!(await provider.getText()).includes("OpenAI")) {
      await clickElement(provider);
      await browser.waitUntil(async () => {
        for (const option of await $$('[role="option"]')) {
          if (await option.isDisplayed() && (await option.getText()).includes("OpenAI")) return true;
        }
        return false;
      }, { timeout: 5_000, timeoutMsg: "OpenAI provider option did not appear" });
      await clickElement(await visibleElementContaining('[role="option"]', ["OpenAI"]));
    }
    await clickElement(await visibleElementContaining("button", ["環境変数から読み込む", "Load from environment"]));
    await browser.waitUntil(async () => /環境変数からAPIキーを読み込みました|API key loaded from environment/.test(await (await $("body")).getText()), {
      timeout: 15_000,
      timeoutMsg: "the Tauri process did not resolve OPENAI_API_KEY",
    });
    assert.ok((await $("input[type='password']").getValue()).length > 0, "OpenAI key must stay in app memory");
    assert.equal(await $("input[value='gpt-6-luna']").getValue(), "gpt-6-luna");
    const batchApi = await $("#openai-batch-api");
    const useBatchApi = process.env.MML_USE_BATCH_API === "1";
    if ((await batchApi.isSelected()) !== useBatchApi) {
      await clickElement(await $(`label[for="openai-batch-api"]`));
    }
    assert.equal(await batchApi.isSelected(), useBatchApi, "Batch API must be explicitly opted in by the test environment");
    const packInput = await $('[role="dialog"] input[placeholder="MinecraftModsLocalizer"]');
    await setInputValue(packInput, "MML-ATM10SKY-GPT6Luna");
    const chunkSize = Number.parseInt(process.env.MML_CHUNK_SIZE || "100", 10);
    const questChunkSize = Number.parseInt(process.env.MML_QUEST_CHUNK_SIZE || "25", 10);
    assert.ok(Number.isInteger(chunkSize) && chunkSize > 0, "MML_CHUNK_SIZE must be a positive integer");
    assert.ok(Number.isInteger(questChunkSize) && questChunkSize > 0, "MML_QUEST_CHUNK_SIZE must be a positive integer");
    await configureBatchSizes(chunkSize, questChunkSize);
    await browser.keys("Escape");
    await browser.waitUntil(async () => !(await $('[role="dialog"]').isDisplayed()), { timeout: 10_000 });
    }

    const summaries = [];
    const incompleteCategories = [];
    for (const category of activeCategories) {
      await browser.execute(() => window.scrollTo(0, 0));
      const tab = await visibleElementContaining('[role="tab"]', category.tab);
      await clickElement(tab);
      await browser.waitUntil(async () => (await tab.getAttribute("aria-selected")) === "true", {
        timeout: 10_000,
        timeoutMsg: `${category.label} tab did not become active`,
      });
      await selectJapanese();
      await browser.waitUntil(async () => {
        for (const button of await $$("button")) {
          if (!(await button.isDisplayed())) continue;
          const text = await button.getText();
          if (category.scan.some((label) => text.includes(label))) return true;
        }
        return false;
      }, { timeout: 15_000, timeoutMsg: `${category.label} scan button did not appear` });
      const scanButton = await visibleElementContaining("button", category.scan);
      await clickElement(scanButton);
      await browser.waitUntil(async () => {
        const button = await visibleElementContaining("button", category.scan);
        return !/scanning|スキャン中/i.test(await button.getText());
      }, { timeout: 300_000, timeoutMsg: `${category.label} scan did not finish` });
      await dismissUpdatePromptIfPresent();

      if (scanOnly) {
        const rows = await $$("tbody tr");
        const rowTexts = [];
        for (const row of rows) rowTexts.push(await row.getText());
        const existingLocaleRows = rowTexts.filter((text) => /ja_jp exists; skipped|ja_jpあり・スキップ/i.test(text)).length;
        if (category.label === "Mods") {
          let owoRow;
          for (const row of rows) {
            const cells = await row.$$("td");
            if (cells.length >= 3 && (await cells[2].getText()).trim() === "owo") {
              owoRow = row;
              break;
            }
          }
          assert.ok(owoRow, "ATM10's OwoLib rich-text language file should be included in the mod scan");
          let replaceCheckbox;
          let replaceRow;
          for (const row of rows) {
            const checkboxes = await row.$$("[role='checkbox']");
            if (checkboxes.length >= 2) {
              replaceRow = row;
              replaceCheckbox = checkboxes[1];
              break;
            }
          }
          assert.ok(replaceCheckbox, "a mod with an existing locale should expose a per-mod replace checkbox");
          assert.ok(await replaceRow.$("label"), "the replace checkbox should have a clickable label");
          const replaceHint = await replaceRow.$("span[title]");
          assert.ok(replaceHint, "the replace option should explain its effect");
          assert.match(await replaceHint.getAttribute("title"), /\.mml-original\.bak/);
          assert.equal(await replaceCheckbox.getAttribute("aria-checked"), "false");
          await clickElement(await replaceRow.$("label"));
          await browser.waitUntil(async () => (await replaceCheckbox.getAttribute("aria-checked")) === "true", {
            timeout: 5_000,
            timeoutMsg: "per-mod replace opt-in did not activate",
          });
          await clickElement(await replaceRow.$("label"));
          await browser.waitUntil(async () => (await replaceCheckbox.getAttribute("aria-checked")) === "false", {
            timeout: 5_000,
            timeoutMsg: "per-mod replace opt-in did not reset",
          });
        }
        const summary = `${category.label}: scan-only (${rows.length} rows; ${existingLocaleRows} expose an existing locale/output opt-in)`;
        console.log(summary);
        summaries.push(summary);
        continue;
      }

      const completedModIds = category.label === "Mods"
        ? new Set((process.env.MML_SKIP_COMPLETED_MOD_IDS || "").split(",").map((id) => id.trim()).filter(Boolean))
        : new Set();
      const forceTranslationModIds = category.label === "Mods"
        ? new Set((process.env.MML_FORCE_MOD_IDS || "").split(",").map((id) => id.trim()).filter(Boolean))
        : new Set();
      const selection = await selectAllRows(completedModIds);
      if (category.label === "Mods") await optInForcedTranslations(forceTranslationModIds, completedModIds);
      if (selection.skipped) console.log(`Resuming: skipped ${selection.skipped} validated or explicitly excluded mod rows`);
      if (selection.selected === 0) {
        summaries.push(`${category.label}: no untranslated targets selected (${selection.total} scanned)`);
        continue;
      }
      const translateButton = await visibleElementContaining("button", ["Translate", "翻訳"]);
      let clickError;
      try {
        await clickElement(translateButton);
      } catch (error) {
        clickError = error;
      }
      if (await browser.isAlertOpen()) {
        const prompt = await browser.getAlertText();
        await browser.acceptAlert();
        assert.match(prompt, /\.mml-original\.bak|元ファイル/, "only accept the documented legacy-quest backup confirmation");
      } else if (clickError) {
        throw clickError;
      }
      const outcomePattern = /Translation Completed|Translation Partially Completed|Translation Failed|翻訳完了|翻訳部分完了|翻訳失敗|Every selected target already contains|選択した対象はすべて/;
      let idleSince = 0;
      await browser.waitUntil(async () => {
        if (/Every selected target already contains|選択した対象はすべて/.test(await visibleTranslationError())) return true;
        for (const dialog of await $$('[role="dialog"]')) {
          if (await dialog.isDisplayed() && outcomePattern.test(await dialog.getText())) return true;
        }
        if (!(await translateButton.isEnabled())) {
          idleSince = 0;
          return false;
        }
        if (!idleSince) idleSince = Date.now();
        return Date.now() - idleSince >= 15_000;
      }, {
        timeout: 24 * 60 * 60 * 1000,
        interval: 2_000,
        timeoutMsg: `${category.label} translation did not complete or return to idle`,
      });

      if (/Every selected target already contains|選択した対象はすべて/.test(await visibleTranslationError())) {
        summaries.push(`${category.label}: all existing translations skipped (${selection.total} scanned)`);
        continue;
      }
      let completion;
      for (const dialog of await $$('[role="dialog"]')) {
        if (await dialog.isDisplayed() && outcomePattern.test(await dialog.getText())) {
          completion = dialog;
          break;
        }
      }
      if (!completion) {
        summaries.push(`${category.label}: app returned to idle without a completion result; output audit required`);
        incompleteCategories.push(category.label);
        continue;
      }
      const completionText = await completion.getText();
      const completed = !/Translation Partially Completed|Translation Failed|翻訳部分完了|翻訳失敗/.test(completionText)
        && /Translation Completed|翻訳完了/.test(completionText);
      summaries.push(`${category.label}: ${completed ? "completed" : "partial/failed"} (${selection.selected} selected; ${selection.skipped} resumed)`);
      if (!completed) incompleteCategories.push(category.label);

      const closeButtons = [];
      for (const button of await completion.$$('button')) {
        if (/Close|閉じる/.test(await button.getText())) closeButtons.push(button);
      }
      assert.ok(closeButtons.length > 0, `${category.label} completion dialog should have a close button`);
      // The dialog's icon-only close button is first; use the explicit footer action
      // so the completion state is finalized before switching categories.
      await clickElement(closeButtons[closeButtons.length - 1]);
      await browser.keys("Escape");
      await browser.waitUntil(async () => {
        try {
          return (await completion.getAttribute("data-state")) === "closed" || !(await completion.isDisplayed());
        }
        catch { return true; }
      }, { timeout: 15_000, timeoutMsg: `${category.label} completion dialog did not close` });
    }

    console.log(`ATM10 SKY translation summary: ${summaries.join("; ")}`);
    assert.deepEqual(incompleteCategories, [], `translation failures in: ${incompleteCategories.join(", ")}`);
  });
});
