import assert from "node:assert/strict";

describe("Tauri logging", () => {
  it("shows categorized logs in the desktop log viewer", async () => {
    await browser.switchToWindow(await browser.getWindowHandle());
    await browser.waitUntil(async () => await $("body").isDisplayed(), {
      timeout: 120_000,
      timeoutMsg: "Tauri app window did not become available",
    });

    const message = `logging-contract-${Date.now()}`;
    await browser.execute(async (entry) => {
      await window.__TAURI_INTERNALS__.invoke("log_translation_process", { message: entry });
    }, message);

    const debugLogs = await $('[title="Debug Logs"], [title="デバッグログ"]');
    await debugLogs.click();
    await browser.waitUntil(async () => (await $("body").getText()).includes(message), {
      timeout: 10_000,
      timeoutMsg: "categorized Tauri log did not appear in the desktop viewer",
    });

    const text = await $("body").getText();
    assert.match(text, /\[TRANSLATION\]/);
    assert.ok(text.includes(message));
  });
});
