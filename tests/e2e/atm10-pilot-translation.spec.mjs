import assert from "node:assert/strict";

async function clickElement(element) {
  await browser.execute((target) => {
    target.scrollIntoView({ block: "center", inline: "nearest" });
    target.click();
  }, element);
}

async function visibleElementContaining(selector, labels) {
  for (const element of await $$(selector)) {
    if (!(await element.isDisplayed())) continue;
    const text = (await element.getText()).trim();
    if (labels.some((label) => text.includes(label))) return element;
  }
  throw new Error(`Could not find visible ${selector} containing: ${labels.join(" / ")}`);
}

describe("ATM10 SKY live GPT-6 Luna pilot", () => {
  before(async () => {
    await browser.switchToWindow(await browser.getWindowHandle());
    await browser.waitUntil(async () => await $("body").isDisplayed(), {
      timeout: 120_000,
      timeoutMsg: "Tauri app window did not become available",
    });
  });

  it("resolves the injected key and translates one real mod entry", async () => {
    await browser.waitUntil(async () => /ATM10SKY/.test(await (await $("body")).getText()), {
      timeout: 30_000,
      timeoutMsg: "the saved ATM10 SKY profile was not loaded",
    });

    const settingsButton = await $("button[aria-label='設定'], button[aria-label='Settings']");
    await clickElement(settingsButton);
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
    const environmentButton = await visibleElementContaining("button", ["環境変数から読み込む", "Load from environment"]);
    await clickElement(environmentButton);
    await browser.waitUntil(async () => /環境変数からAPIキーを読み込みました|API key loaded from environment/.test(await (await $("body")).getText()), {
      timeout: 10_000,
      timeoutMsg: "the Tauri process did not resolve the OpenAI key from its environment",
    });
    assert.ok((await $("input[type='password']").getValue()).length > 0, "environment key should be present only in the app's in-memory settings");
    await $('[role="dialog"] input[placeholder="MinecraftModsLocalizer"]').setValue("MML-ATM10SKY-GPT6Luna-Pilot");
    await browser.keys("Escape");
    await browser.waitUntil(async () => !(await $('[role="dialog"]').isDisplayed()), {
      timeout: 10_000,
      timeoutMsg: "settings dialog did not close after loading the environment key",
    });

    await $("#lang-select-tabs-targetLanguage").click();
    await clickElement(await visibleElementContaining('[role="option"]', ["日本語 (ja_jp)"]));

    const scanButton = await visibleElementContaining("button", ["Scan Mods", "Modをスキャン"]);
    assert.equal(await scanButton.isEnabled(), true, "saved ATM10 SKY path should enable mod scanning");
    await clickElement(scanButton);
    await browser.waitUntil(async () => (await $$("tbody tr")).length > 1, {
      timeout: 300_000,
      timeoutMsg: "ATM10 SKY mod scan did not finish",
    });

    const pilotPattern = /true.?power|ars.?ocultas|supermartijn642|toast.?control|fastleafdecay/i;
    const rows = await $$("tbody tr");
    console.log(`Mod rows available for pilot: ${rows.length}`);
    let pilotRow;
    for (const row of rows) {
      const text = await row.getText();
      if (pilotPattern.test(text)) {
        pilotRow = row;
        console.log(`Selected pilot source: ${text}`);
        break;
      }
    }
    assert.ok(pilotRow, "an isolated small English-only pilot mod should be listed in ATM10 SKY");
    const selectAll = await $("thead [role=checkbox]");
    await clickElement(selectAll);
    await clickElement(selectAll);

    const [selection] = await pilotRow.$$('[role="checkbox"]');
    assert.equal(await selection.getAttribute("aria-checked"), "false");
    await clickElement(selection);
    await browser.waitUntil(async () => (await selection.getAttribute("aria-checked")) === "true", {
      timeout: 5_000,
      timeoutMsg: "could not select the isolated pilot mod",
    });

    await clickElement(await visibleElementContaining("button", ["Translate", "翻訳"]));
    await browser.waitUntil(async () => {
      const text = await (await $("body")).getText();
      return /翻訳完了|Translation Completed|翻訳失敗|Translation Failed|APIキーが設定されていない|API key is not configured/.test(text);
    }, {
      timeout: 300_000,
      timeoutMsg: "the pilot did not finish or report an actionable error",
    });

    const bodyText = await (await $("body")).getText();
    assert.match(bodyText, /翻訳完了|Translation Completed/, `pilot translation failed: ${bodyText}`);
    assert.match(bodyText, /1件の|Successfully translated 1/, `expected exactly one translated mod: ${bodyText}`);

    await clickElement(await visibleElementContaining('[role="dialog"] button', ["閉じる", "Close"]));
  });
});
