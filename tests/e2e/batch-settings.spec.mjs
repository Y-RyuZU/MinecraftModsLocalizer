import assert from "node:assert/strict";

const providers = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "gemini", label: "Google Gemini" },
];

async function clickOption(label) {
  for (const option of await $$('[role="option"]')) {
    if ((await option.getText()).includes(label)) {
      await option.click();
      return;
    }
  }
  throw new Error(`Provider option not found: ${label}`);
}

describe("provider Batch API settings", () => {
  it("keeps each provider's Batch API checkbox off by default", async () => {
    await browser.switchToWindow(await browser.getWindowHandle());
    const settingsButton = await $('button[aria-label="Settings"], button[aria-label="設定"]');
    await settingsButton.click();

    const dialog = await $('[role="dialog"]');
    const providerSelect = await dialog.$('[role="combobox"]');
    for (const provider of providers) {
      await providerSelect.click();
      await browser.waitUntil(async () => {
        for (const option of await $$('[role="option"]')) {
          if (await option.isDisplayed()) return true;
        }
        return false;
      }, { timeout: 5_000, timeoutMsg: "provider options did not open" });
      await clickOption(provider.label);
      const checkbox = await $(`#${provider.id}-batch-api`);
      await checkbox.waitForDisplayed();
      assert.equal(await checkbox.isSelected(), false, `${provider.label} Batch API must default to off`);
    }

    for (const button of await dialog.$$('button')) {
      if (["Discard", "破棄"].includes((await button.getText()).trim())) {
        await button.click();
        return;
      }
    }
    throw new Error("Could not find the settings discard button");
  });
});
