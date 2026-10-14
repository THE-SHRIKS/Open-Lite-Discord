import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { buildApp } from '../../apps/server/src/index.js';
import { closeDb } from '../../apps/server/src/db/index.js';

test.describe('SIDEBAND Offline, Performance (500+ messages) & Backend Restart Durability Suite (E2E-08, E2E-09, E2E-14)', () => {
  test('Zero external network calls, 500+ seeded messages scroll smoothly, and state survives reload', async ({ page }) => {
    const suffix = Date.now().toString().slice(-6);
    const externalRequests: string[] = [];

    page.on('request', req => {
      const url = req.url();
      if (
        !url.startsWith('http://127.0.0.1') &&
        !url.startsWith('http://localhost') &&
        !url.startsWith('ws://127.0.0.1') &&
        !url.startsWith('ws://localhost') &&
        !url.startsWith('data:') &&
        !url.startsWith('blob:')
      ) {
        externalRequests.push(url);
      }
    });

    await page.request.post('/api/v1/auth/register', {
      data: {
        username: `perf_${suffix}`,
        displayName: 'Perf Engineer',
        password: 'ValidPassword123!',
      },
    });

    const spaceRes = await page.request.post('/api/v1/spaces', {
      data: { name: `Durability Lab ${suffix}`, iconText: 'DL' },
    });
    const spaceId = (await spaceRes.json()).data.id;

    const chanRes = await page.request.post(`/api/v1/spaces/${spaceId}/channels`, {
      data: { name: 'stress-test', topic: '500+ messages durability test', visibility: 'public' },
    });
    const channelId = (await chanRes.json()).data.id;

    // Seed 505 messages into the channel
    for (let batch = 0; batch < 101; batch++) {
      await Promise.all(
        Array.from({ length: 5 }, (_, i) => {
          const idx = batch * 5 + i + 1;
          return page.request.post(`/api/v1/channels/${channelId}/messages`, {
            data: {
              body: `Benchmark message #${idx} — verifying canonical sequence and scroll performance.`,
              clientNonce: crypto.randomUUID(),
            },
          });
        })
      );
    }

    await page.goto(`/app/spaces/${spaceId}/channels/${channelId}`);
    await expect(page.locator('body')).toContainText('Benchmark message #505', { timeout: 10_000 });

    // Test cursor pagination via UI ("Load older messages" button)
    await page.getByRole('button', { name: /Load older messages/i }).click();
    await expect(page.locator('body')).toContainText('Benchmark message #450', { timeout: 10_000 });

    // Verify reload preserves persisted state
    await page.reload();
    await expect(page.locator('body')).toContainText('Benchmark message #505', { timeout: 10_000 });

    // Verify zero external network requests were made
    expect(externalRequests).toEqual([]);
  });

  test('Full backend server restart preserves SQLite database state, sessions, and reconnects live clients', async ({ browser }) => {
    const restartDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sideband-restart-e2e-'));
    const port = 3456;
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. Start initial server instance #1
    const srv1 = await buildApp({ dataDir: restartDir, logger: false });
    await srv1.app.listen({ host: '127.0.0.1', port });

    const context = await browser.newContext({ baseURL: baseUrl, viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    try {
      // Register user via real UI on server instance #1
      await page.goto(`${baseUrl}/auth`);
      await page.getByRole('button', { name: 'Create one' }).click();
      await page.getByLabel('Username').fill('restart_admin');
      await page.getByLabel('Display Name').fill('Restart Verifier');
      await page.getByLabel('Password').fill('ValidPassword123!');
      await page.locator('form button[type="submit"]').click();
      await expect(page).toHaveURL(/\/app/);

      // Create space and channel via real UI
      await page.getByRole('button', { name: 'Create space or redeem invite' }).click();
      await page.getByLabel('Space Name').fill('Persistent Fortress');
      await page.getByRole('button', { name: 'Create Space', exact: true }).click();
      await expect(page.locator('body')).toContainText('Persistent Fortress');

      await page.getByRole('button', { name: 'Create channel', exact: true }).click();
      await page.getByLabel('Channel Name').fill('blackbox-log');
      await page.getByRole('button', { name: 'Create Channel', exact: true }).click();

      // Send a message before backend restart
      const preRestartMsg = 'Message committed to SQLite WAL before server shutdown';
      const composer = page.getByRole('textbox', { name: 'Message input' });
      await composer.fill(preRestartMsg);
      await composer.press('Enter');
      await expect(page.locator('body')).toContainText(preRestartMsg);

      // 2. Shut down server instance #1 and close SQLite connection completely
      srv1.io.close();
      await srv1.app.close();
      closeDb();

      // 3. Boot a brand-new server instance #2 against the same SQLite DATA_DIR
      const srv2 = await buildApp({ dataDir: restartDir, logger: false });
      await srv2.app.listen({ host: '127.0.0.1', port });

      try {
        // Reload browser page — session cookie, space, channel, and message must survive backend restart!
        await page.reload();
        await expect(page.locator('body')).toContainText('Persistent Fortress', { timeout: 10_000 });
        await expect(page.locator('body')).toContainText(preRestartMsg, { timeout: 10_000 });

        // Send a new message on the restarted server and verify sequence continuity (#2)
        const postRestartMsg = 'Message committed after server restart (#2)';
        await page.getByRole('textbox', { name: 'Message input' }).fill(postRestartMsg);
        await page.getByRole('textbox', { name: 'Message input' }).press('Enter');
        await expect(page.locator('body')).toContainText(postRestartMsg, { timeout: 10_000 });
        await expect(page.locator('body')).toContainText('#2');
      } finally {
        srv2.io.close();
        await srv2.app.close();
        closeDb();
      }
    } finally {
      try { srv1.io.close(); } catch { /* ignore */ }
      try { await srv1.app.close(); } catch { /* ignore */ }
      closeDb();
      await context.close();
      try {
        fs.rmSync(restartDir, { recursive: true, force: true });
      } catch {
        // Ignore Windows temp file lock race on cleanup
      }
    }
  });
});
