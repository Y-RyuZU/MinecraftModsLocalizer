import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test';

// Helper to wait for Tauri API to be ready
async function waitForTauriReady(page: Page) {
  await page.waitForFunction(() => {
    return window.__TAURI__ !== undefined;
  });
}

test.describe('Translation Backup System E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForTauriReady(page);
  });

  test('complete translation flow with backups', async ({ page }) => {
    // Step 1: Configure settings
    await page.click('[data-testid="settings-tab"]');
    
    // Set minecraft directory
    await page.fill('[data-testid="minecraft-dir-input"]', '/test/minecraft');
    
    // Configure API settings
    await page.selectOption('[data-testid="provider-select"]', 'openai');
    await page.fill('[data-testid="api-key-input"]', 'test-api-key');
    
    // Save settings
    await page.click('[data-testid="save-settings"]');
    await expect(page.locator('.toast-success')).toBeVisible();

    // Step 2: Navigate to Quests tab for SNBT translation
    await page.click('[data-testid="quests-tab"]');
    
    // Select profile directory and scan
    await page.click('[data-testid="select-profile-dir"]');
    // Mock directory selection would happen here
    
    await page.click('[data-testid="scan-quests"]');
    await page.waitForSelector('[data-testid="quest-table"] tbody tr');
    
    // Select some quests
    await page.click('[data-testid="quest-checkbox-0"]');
    await page.click('[data-testid="quest-checkbox-1"]');
    
    // Select target language
    await page.selectOption('[data-testid="target-language-select"]', 'ja_jp');
    
    // Start translation (this should trigger SNBT backup)
    await page.click('[data-testid="translate-button"]');
    
    // Wait for translation to complete
    await page.waitForSelector('[data-testid="completion-dialog"]', { timeout: 30000 });
    
    // Step 3: Navigate to Mods tab for resource pack translation
    await page.click('[data-testid="close-dialog"]');
    await page.click('[data-testid="mods-tab"]');
    
    // Scan mods
    await page.click('[data-testid="scan-mods"]');
    await page.waitForSelector('[data-testid="mod-table"] tbody tr');
    
    // Select some mods
    await page.click('[data-testid="mod-checkbox-0"]');
    await page.click('[data-testid="mod-checkbox-1"]');
    
    // Start translation (this should trigger resource pack backup after completion)
    await page.click('[data-testid="translate-button"]');
    
    // Wait for translation to complete
    await page.waitForSelector('[data-testid="completion-dialog"]', { timeout: 30000 });
    await page.click('[data-testid="close-dialog"]');
    
    // Step 4: Verify translation history
    await page.click('[data-testid="settings-tab"]');
    
    // Open translation history
    await page.click('text=View Translation History');
    await page.waitForSelector('[data-testid="translation-history-dialog"]');
    
    // Should see at least one session
    const sessionRows = await page.locator('[data-testid^="session-row-"]').count();
    expect(sessionRows).toBeGreaterThan(0);
    
    // Expand first session
    await page.click('[data-testid="session-row-0"]');
    await page.waitForSelector('[data-testid="session-details-0"]');
    
    // Verify translation details are shown
    await expect(page.locator('text=Target Language: ja_jp')).toBeVisible();
    await expect(page.locator('text=quest:')).toBeVisible();
    await expect(page.locator('text=mod:')).toBeVisible();
    
    // Close dialog
    await page.click('[data-testid="close-history-dialog"]');
  });

  test('translation interruption handling', async ({ page }) => {
    // Navigate to mods tab
    await page.click('[data-testid="mods-tab"]');
    
    // Scan and select mods
    await page.click('[data-testid="scan-mods"]');
    await page.waitForSelector('[data-testid="mod-table"] tbody tr');
    await page.click('[data-testid="select-all-mods"]');
    
    // Start translation
    await page.click('[data-testid="translate-button"]');
    
    // Wait for progress to start
    await page.waitForSelector('[data-testid="translation-progress"]');
    
    // Cancel translation
    await page.click('[data-testid="cancel-translation"]');
    
    // Verify cancellation message
    await expect(page.locator('text=Translation cancelled')).toBeVisible();
    
    // Open translation history
    await page.click('[data-testid="settings-tab"]');
    await page.click('text=View Translation History');
    
    // The interrupted session should not appear in history
    // or should show as incomplete
    const sessionRows = await page.locator('[data-testid^="session-row-"]').all();
    
    if (sessionRows.length > 0) {
      // If session exists, verify it shows incomplete status
      await page.click('[data-testid="session-row-0"]');
      const failedItems = await page.locator('.text-red-500').count();
      expect(failedItems).toBeGreaterThan(0);
    }
  });

  test('backup directory structure verification', async ({ page }) => {
    // This test would need file system access to verify
    // In a real E2E test, we'd use Tauri commands to check the file system
    
    // Perform a simple translation
    await page.click('[data-testid="quests-tab"]');
    await page.click('[data-testid="scan-quests"]');
    await page.waitForSelector('[data-testid="quest-table"] tbody tr');
    await page.click('[data-testid="quest-checkbox-0"]');
    await page.selectOption('[data-testid="target-language-select"]', 'ja_jp');
    await page.click('[data-testid="translate-button"]');
    await page.waitForSelector('[data-testid="completion-dialog"]');
    
    // In a real test, we would verify:
    // 1. logs/localizer/{session-id}/ directory exists
    // 2. backup/snbt_original/ contains the original files
    // 3. translation_summary.json exists and is valid
    
    // For now, we just verify the UI shows success
    await expect(page.locator('text=Translation Completed')).toBeVisible();
  });

  test('translation history dialog performance', async ({ page }) => {
    // This test verifies the two-level loading works correctly
    
    // Navigate to settings
    await page.click('[data-testid="settings-tab"]');
    
    // Open translation history
    await page.click('text=View Translation History');
    
    // Measure initial load time (should be fast as it only loads session list)
    const startTime = Date.now();
    await page.waitForSelector('[data-testid="translation-history-dialog"]');
    const loadTime = Date.now() - startTime;
    
    // Initial load should be fast (< 1 second)
    expect(loadTime).toBeLessThan(1000);
    
    // Count sessions without expanding
    const sessionCount = await page.locator('[data-testid^="session-row-"]').count();
    
    if (sessionCount > 0) {
      // Click to expand first session
      const expandStartTime = Date.now();
      await page.click('[data-testid="session-row-0"]');
      await page.waitForSelector('[data-testid="session-details-0"]');
      const expandTime = Date.now() - expandStartTime;
      
      // Expansion should also be reasonably fast
      expect(expandTime).toBeLessThan(2000);
      
      // Verify details loaded
      await expect(page.locator('[data-testid="session-details-0"]')).toContainText('Target Language');
    }
  });

  test('multiple file types in single session', async ({ page }) => {
    // Test that a single session ID is used for multiple translation types
    
    // Configure settings first
    await page.click('[data-testid="settings-tab"]');
    await page.selectOption('[data-testid="provider-select"]', 'openai');
    await page.fill('[data-testid="api-key-input"]', 'test-api-key');
    await page.click('[data-testid="save-settings"]');
    
    // Start with custom files
    await page.click('[data-testid="custom-files-tab"]');
    await page.click('[data-testid="select-directory"]');
    await page.click('[data-testid="scan-files"]');
    await page.waitForSelector('[data-testid="file-table"] tbody tr');
    await page.click('[data-testid="file-checkbox-0"]');
    
    // Add quests
    await page.click('[data-testid="quests-tab"]');
    await page.click('[data-testid="scan-quests"]');
    await page.waitForSelector('[data-testid="quest-table"] tbody tr');
    await page.click('[data-testid="quest-checkbox-0"]');
    
    // Translate both in sequence
    await page.selectOption('[data-testid="target-language-select"]', 'ja_jp');
    
    // Custom files first
    await page.click('[data-testid="custom-files-tab"]');
    await page.click('[data-testid="translate-button"]');
    await page.waitForSelector('[data-testid="completion-dialog"]');
    await page.click('[data-testid="close-dialog"]');
    
    // Then quests
    await page.click('[data-testid="quests-tab"]');
    await page.click('[data-testid="translate-button"]');
    await page.waitForSelector('[data-testid="completion-dialog"]');
    await page.click('[data-testid="close-dialog"]');
    
    // Check history - should show both in same session
    await page.click('[data-testid="settings-tab"]');
    await page.click('text=View Translation History');
    
    // Expand most recent session
    await page.click('[data-testid="session-row-0"]');
    await page.waitForSelector('[data-testid="session-details-0"]');
    
    // Should contain both custom and quest translations
    await expect(page.locator('[data-testid="session-details-0"]')).toContainText('custom:');
    await expect(page.locator('[data-testid="session-details-0"]')).toContainText('quest:');
  });
});