import assert from "node:assert/strict";

async function clickElement(element) {
  await browser.execute((target) => {
    target.scrollIntoView({ block: "center", inline: "nearest" });
    target.click();
  }, element);
}

async function setInputValue(element, value) {
  await browser.execute((target, nextValue) => {
    target.scrollIntoView({ block: "center", inline: "nearest" });
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("HTML input value setter is unavailable");
    setter.call(target, nextValue);
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }, element, String(value));
}

async function configureBatchSizes(size) {
  const numericInputs = await $$('[role="dialog"] input[type="number"]');
  assert.ok(numericInputs.length >= 5, "settings should expose three translation chunk sizes");
  if (numericInputs.length > 5) await setInputValue(numericInputs[2], "3000"); // token budget; not a key batch size
  for (const input of numericInputs.slice(-3)) {
    await setInputValue(input, size);
  }
  assert.deepEqual(await Promise.all(numericInputs.slice(-3).map((input) => input.getValue())), [String(size), String(size), String(size)]);
}

async function selectOpenAIIfNeeded() {
  const provider = await $('[role="dialog"] [role="combobox"]');
  if ((await provider.getText()).includes("OpenAI")) return;
  await clickElement(provider);
  await browser.waitUntil(async () => {
    for (const option of await $$('[role="option"]')) {
      if (await option.isDisplayed() && (await option.getText()).includes("OpenAI")) return true;
    }
    return false;
  }, { timeout: 5_000, timeoutMsg: "OpenAI provider option did not appear" });
  await clickElement(await (async () => {
    for (const option of await $$('[role="option"]')) {
      if (await option.isDisplayed() && (await option.getText()).includes("OpenAI")) return option;
    }
    throw new Error("OpenAI provider option disappeared before selection");
  })());
}

describe("ATM10 SKY translation configuration", () => {
  before(async () => {
    await browser.switchToWindow(await browser.getWindowHandle());
    await browser.waitUntil(async () => await $("body").isDisplayed(), {
      timeout: 120_000,
      timeoutMsg: "Tauri app window did not become available",
    });
  });

  it("sets isolated output and 100-entry batches without loading an API key", async () => {
    const settingsButton = await $("button[aria-label='設定'], button[aria-label='Settings']");
    await clickElement(settingsButton);

    const dialog = await $('[role="dialog"]');
    await dialog.waitForDisplayed();

    await selectOpenAIIfNeeded();
    assert.equal(await $("input[value='gpt-6-luna']").getValue(), "gpt-6-luna");
    const apiKeyInput = await $("input[type='password']");
    console.log(`API key already stored in app: ${(await apiKeyInput.getValue()).length > 0}`);

    const packInput = await $('[role="dialog"] input[placeholder="MinecraftModsLocalizer"]');
    await setInputValue(packInput, "MML-ATM10SKY-GPT6Luna");

    await configureBatchSizes(100);

    await clickElement(await (async () => {
      for (const button of await $$('[role="dialog"] button')) {
        const text = (await button.getText()).trim();
        if (text.includes("設定を保存") || text.includes("Save Settings")) return button;
      }
      throw new Error("Could not find the settings save button");
    })());

    await browser.waitUntil(async () => !(await dialog.isDisplayed()), {
      timeout: 15_000,
      timeoutMsg: "settings dialog did not close after saving",
    });
  });
});
