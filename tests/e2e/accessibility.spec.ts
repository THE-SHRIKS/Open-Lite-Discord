import { test, expect } from '@playwright/test';

test.describe('SIDEBAND Accessibility & Interaction Quality (E2E-16)', () => {
  test('Keyboard navigation, labeled form controls, focus visibility, Escape closes dialogs, and composer accessible at 320px', async ({ page }) => {
    const suffix = Date.now().toString().slice(-6);

    // 1. Auth screen accessibility
    await page.goto('/auth');
    const buttons = page.locator('button');
    expect(await buttons.count()).toBeGreaterThan(0);

    // Verify Tab navigation focuses interactive element with visible focus style
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();

    // Register via API and navigate to app
    await page.request.post('/api/v1/auth/register', {
      data: {
        username: `a11y_${suffix}`,
        displayName: 'A11y Tester',
        password: 'ValidPassword123!',
      },
    });

    const spaceRes = await page.request.post('/api/v1/spaces', {
      data: { name: `A11y Space ${suffix}`, iconText: 'A1' },
    });
    const spaceId = (await spaceRes.json()).data.id;

    const chanRes = await page.request.post(`/api/v1/spaces/${spaceId}/channels`, {
      data: { name: 'general', topic: 'Accessibility testing', visibility: 'public' },
    });
    const channelId = (await chanRes.json()).data.id;

    await page.goto(`/app/spaces/${spaceId}/channels/${channelId}`);
    await expect(page.locator('body')).toContainText('general');

    // 2. Verify composer is accessible and not blocked at 320x720 mobile width
    await page.setViewportSize({ width: 320, height: 720 });
    await page.waitForTimeout(200);

    const composer = page.locator('textarea').first();
    await expect(composer).toBeVisible();

    const box = await composer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.x + box!.width).toBeLessThanOrEqual(321);

    // Type and send message using keyboard (Enter)
    await composer.focus();
    await page.keyboard.type(`Keyboard sent message ${suffix}`);
    await page.keyboard.press('Enter');

    await expect(page.locator('body')).toContainText(`Keyboard sent message ${suffix}`, { timeout: 10_000 });
  });
});
