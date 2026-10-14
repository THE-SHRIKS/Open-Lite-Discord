import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('evidence', 'screenshots');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.describe('SIDEBAND Full-Chain Real-UI Two-User E2E & Stress Suite', () => {
  test('E2E-01..15: Real UI registration, login/logout, space create/edit, channel CRUD, invites, live 2-user chat, rapid messages, edit/delete, private channel grant/revoke, roles, search, and responsive audit', async ({ browser }) => {
    test.setTimeout(90_000);
    const suffix = Date.now().toString().slice(-6);
    const ownerUser = `alice_${suffix}`;
    const memberUser = `bob_${suffix}`;
    const password = 'ValidPassword123!';

    const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const contextB = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // ─── 1. Real UI Registration & Validation (User A) ─────────────────────────
    await pageA.goto('/auth');
    await pageA.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth-screen-1440x900.png') });

    await pageA.getByRole('button', { name: 'Create one' }).click();

    // Test invalid input rejection in UI first
    await pageA.getByLabel('Username').fill(ownerUser);
    await pageA.getByLabel('Display Name').fill('Alice Vance');
    await pageA.getByLabel('Password').fill('short');
    await pageA.locator('form button[type="submit"]').click();
    await expect(pageA.locator('[role="alert"]')).toContainText('Password must be at least 8 characters');

    // Submit valid registration via UI
    await pageA.getByLabel('Password').fill(password);
    await pageA.locator('form button[type="submit"]').click();
    await expect(pageA).toHaveURL(/\/app/);
    await expect(pageA.locator('body')).toContainText('No workspaces yet');

    // Verify session persists across page reload
    await pageA.reload();
    await expect(pageA.locator('body')).toContainText('No workspaces yet');

    // ─── 2. Real UI Space Creation & Space Editing ─────────────────────────────
    await pageA.getByRole('button', { name: 'Create space or redeem invite' }).click();
    await pageA.getByLabel('Space Name').fill(`Signal Lab ${suffix}`);
    await pageA.getByLabel('Badge Text (optional)').fill('SL');
    await pageA.getByRole('button', { name: 'Create Space', exact: true }).click();

    await expect(pageA.locator('body')).toContainText(`Signal Lab ${suffix}`);

    // Edit space name via Space Settings modal
    await pageA.getByRole('button', { name: 'Space settings' }).click();
    await pageA.getByLabel('Space Name').fill(`Signal HQ ${suffix}`);
    await pageA.getByRole('button', { name: 'Save Space' }).click();
    await expect(pageA.locator('body')).toContainText(`Signal HQ ${suffix}`);

    // ─── 3. Real UI Channel Creation (#general, #build-log, private #vault) ────
    await pageA.getByRole('button', { name: 'Create channel', exact: true }).click();
    await pageA.getByLabel('Channel Name').fill('general');
    await pageA.getByLabel('Topic (optional)').fill('General engineering telemetry');
    await pageA.getByRole('button', { name: 'Create Channel', exact: true }).click();
    await expect(pageA.locator('body')).toContainText('General engineering telemetry');

    await pageA.getByRole('button', { name: 'Create channel', exact: true }).click();
    await pageA.getByLabel('Channel Name').fill('build-log');
    await pageA.getByLabel('Topic (optional)').fill('CI build pipeline output');
    await pageA.getByRole('button', { name: 'Create Channel', exact: true }).click();
    await expect(pageA.locator('body')).toContainText('CI build pipeline output');

    await pageA.getByRole('button', { name: 'Create channel', exact: true }).click();
    await pageA.getByLabel('Channel Name').fill('vault');
    await pageA.getByLabel('Topic (optional)').fill('Restricted security ops');
    await pageA.getByRole('radio', { name: /Private/i }).check();
    await pageA.getByRole('button', { name: 'Create Channel', exact: true }).click();
    await expect(pageA.locator('body')).toContainText('Restricted security ops');

    // Send a classified message inside #vault via UI composer
    const vaultSecret = `CLASSIFIED_VAULT_TOKEN_${suffix}`;
    const composerA = pageA.getByRole('textbox', { name: 'Message input' });
    await composerA.fill(vaultSecret);
    await composerA.press('Enter');
    await expect(pageA.locator('body')).toContainText(vaultSecret);

    // ─── 4. Real UI Invite Generation, Revocation & Second User Join ───────────
    await pageA.getByRole('button', { name: 'Invite people to space' }).click();
    const inviteInput = pageA.getByRole('textbox', { name: 'Generated invite URL' });
    await expect(inviteInput).toBeVisible();
    const firstInviteUrl = await inviteInput.inputValue();
    expect(firstInviteUrl).toContain('/invite/');

    // Revoke the first invite via UI and generate a fresh one
    await pageA.getByRole('button', { name: 'Revoke' }).first().click();
    await pageA.getByRole('button', { name: 'Generate New Invite Link' }).click();
    await expect(pageA.getByRole('button', { name: 'Revoke' })).toBeVisible();
    const activeInviteUrl = await inviteInput.inputValue();
    const invitePath = new URL(activeInviteUrl).pathname;
    await pageA.getByRole('button', { name: 'Done' }).click();

    // User B registers via UI in isolated browser context B
    await pageB.goto('/auth');
    await pageB.getByRole('button', { name: 'Create one' }).click();
    await pageB.getByLabel('Username').fill(memberUser);
    await pageB.getByLabel('Display Name').fill('Bob Member');
    await pageB.getByLabel('Password').fill(password);
    await pageB.locator('form button[type="submit"]').click();
    await expect(pageB).toHaveURL(/\/app/);

    // Verify revoked first invite is rejected via UI
    const revokedPath = new URL(firstInviteUrl).pathname;
    await pageB.goto(revokedPath);
    await pageB.getByRole('button', { name: 'Accept & Enter Workspace' }).click();
    await expect(pageB.locator('[role="alert"]')).toContainText('revoked');

    // User B redeems the active invite via UI
    await pageB.goto(invitePath);
    await pageB.getByRole('button', { name: 'Accept & Enter Workspace' }).click();
    await expect(pageB).toHaveURL(/\/app\/spaces\//);
    await expect(pageB.locator('body')).toContainText(`Signal HQ ${suffix}`);

    // Both users navigate to #general via UI click
    await pageA.getByRole('button', { name: /general/i }).first().click();
    await pageB.getByRole('button', { name: /general/i }).first().click();

    // ─── 5. Real-Time Two-User Chat, Rapid Consecutive Messages, Edit & Delete ─
    const liveMsgA = `Live telemetry ping from Alice [${suffix}]`;
    await composerA.fill(liveMsgA);
    await composerA.press('Enter');

    // User B sees Alice's message in real time via Socket.IO
    await expect(pageB.locator('body')).toContainText(liveMsgA, { timeout: 10_000 });

    const liveMsgB = `Telemetry received loud and clear by Bob [${suffix}]`;
    const composerB = pageB.getByRole('textbox', { name: 'Message input' });
    await composerB.fill(liveMsgB);
    await composerB.press('Enter');

    // User A sees Bob's reply in real time via Socket.IO
    await expect(pageA.locator('body')).toContainText(liveMsgB, { timeout: 10_000 });

    // Rapid consecutive messages stress test (5 messages sent rapidly via UI)
    for (let i = 1; i <= 5; i++) {
      await composerA.fill(`Rapid burst packet #${i} [${suffix}]`);
      await composerA.press('Enter');
    }
    for (let i = 1; i <= 5; i++) {
      await expect(pageB.locator('body')).toContainText(`Rapid burst packet #${i} [${suffix}]`, { timeout: 10_000 });
    }

    await pageA.screenshot({ path: path.join(SCREENSHOT_DIR, 'two-user-chat-userA-1440x900.png') });
    await pageB.screenshot({ path: path.join(SCREENSHOT_DIR, 'two-user-chat-userB-1440x900.png') });

    // Edit message via UI and verify live propagation to User B
    const msgRowA = pageA.locator('[id^="msg-"]').first();
    await msgRowA.hover();
    await pageA.getByRole('button', { name: 'Edit message' }).first().click();
    const editBox = pageA.getByRole('textbox', { name: 'Edit message body' });
    const editedText = `Edited telemetry ping from Alice [${suffix}]`;
    await editBox.fill(editedText);
    await pageA.getByRole('button', { name: 'Save' }).click();

    await expect(pageB.locator('body')).toContainText(editedText, { timeout: 10_000 });
    await expect(pageB.locator('body')).toContainText('(edited)');

    // Soft-delete a message via UI and verify tombstone propagation
    const lastMsgRowA = pageA.locator('[id^="msg-"]').last();
    await lastMsgRowA.hover();
    await lastMsgRowA.getByRole('button', { name: 'Delete message' }).click();
    await expect(pageB.locator('body')).toContainText('Message deleted', { timeout: 10_000 });

    // ─── 6. Private Channel Enforcement, Live Grant & Live Revocation via UI ───
    // User B does NOT see #vault in ChannelList before grant
    await expect(pageB.getByRole('button', { name: /vault/i })).toHaveCount(0);

    // User A opens Channel Settings on #vault and grants access to Bob via UI
    await pageA.locator('button[aria-label="Settings for #vault"]').click();
    await expect(pageA.locator('body')).toContainText('Private Channel Access');
    await pageA.getByRole('button', { name: 'Grant Access' }).click();
    await expect(pageA.getByRole('button', { name: 'Revoke Access' })).toBeVisible();
    await pageA.getByRole('button', { name: 'Cancel' }).click();

    // User B's channel list updates live via Socket.IO — User B clicks #vault and sees the secret!
    await expect(pageB.getByRole('button', { name: /vault/i }).first()).toBeVisible({ timeout: 10_000 });
    await pageB.getByRole('button', { name: /vault/i }).first().click();
    await expect(pageB.locator('body')).toContainText(vaultSecret, { timeout: 10_000 });

    // User A revokes Bob's access to #vault via UI
    await pageA.locator('button[aria-label="Settings for #vault"]').click();
    await pageA.getByRole('button', { name: 'Revoke Access' }).click();
    await pageA.getByRole('button', { name: 'Cancel' }).click();

    // User B is immediately ejected from #vault in real time (#vault removed from list and secret no longer visible)
    await expect(pageB.getByRole('button', { name: /vault/i })).toHaveCount(0, { timeout: 10_000 });
    await expect(pageB.locator('body')).not.toContainText(vaultSecret);
    await pageB.getByRole('button', { name: /general/i }).first().click();

    // ─── 7. Role Management & Audit Log via UI ─────────────────────────────────
    await pageA.locator('aside[aria-label="Workspace members"]').getByText('Bob Member').click();
    await pageA.getByRole('radio', { name: /Admin/i }).check();
    await pageA.getByRole('button', { name: 'Save Changes' }).click();
    await expect(pageA.locator('aside[aria-label="Workspace members"]')).toContainText('Admins — 1');

    // Check Audit Log tab in MemberPanel
    await pageA.getByRole('button', { name: 'Audit Log' }).click();
    await expect(pageA.locator('aside[aria-label="Workspace members"]')).toContainText('member:role_changed');
    await pageA.getByRole('button', { name: 'Members', exact: true }).click();

    // ─── 8. Search Panel & Jump-to-Message via UI ──────────────────────────────
    await pageA.getByRole('button', { name: 'Search messages' }).first().click();
    const searchInput = pageA.getByRole('textbox', { name: 'Search messages in space' });
    await searchInput.fill('Edited telemetry');
    await expect(pageA.locator('[role="dialog"]')).toContainText(editedText, { timeout: 10_000 });
    await pageA.locator('[role="dialog"] [role="button"]').first().click();
    await expect(pageA).toHaveURL(/highlight=/);

    // ─── 9. Settings Profile Update, Logout, Re-Login & Socket Reconnect via UI ─
    await pageB.getByRole('button', { name: 'User settings' }).first().click();
    const displayInput = pageB.getByLabel('Display Name');
    await displayInput.fill('Bob Mercer Verified');
    await pageB.getByRole('button', { name: 'Save Profile' }).click();
    await expect(pageB.locator('body')).toContainText('Profile display name updated successfully');

    // Sign out User B via UI
    await pageB.getByRole('button', { name: 'Sign Out' }).click();
    await expect(pageB).toHaveURL(/\/auth/);
    const unauthMe = await pageB.request.get('/api/v1/auth/me');
    expect(unauthMe.status()).toBe(401);

    // Sign back in User B via UI (verifies SPA login reconnects Socket.IO!)
    await pageB.getByLabel('Username').fill(memberUser);
    await pageB.getByLabel('Password').fill(password);
    await pageB.locator('form button[type="submit"]').click();
    await expect(pageB).toHaveURL(/\/app/);
    await expect(pageB.locator('body')).toContainText('Bob Mercer Verified');

    // Verify User B's socket reconnected after SPA logout->login by receiving a new live message from User A
    const postReconnectMsg = `Post-reconnect live check [${suffix}]`;
    await composerA.fill(postReconnectMsg);
    await composerA.press('Enter');
    await expect(pageB.locator('body')).toContainText(postReconnectMsg, { timeout: 10_000 });

    // ─── 10. Responsive Viewports & Mobile Navigation Drawer Audit ─────────────
    const viewports = [
      { width: 1440, height: 900, name: '1440x900' },
      { width: 1024, height: 768, name: '1024x768' },
      { width: 768, height: 1024, name: '768x1024' },
      { width: 390, height: 844, name: '390x844' },
      { width: 320, height: 720, name: '320x720' },
    ];

    for (const vp of viewports) {
      await pageA.setViewportSize({ width: vp.width, height: vp.height });
      await pageA.waitForTimeout(200);
      const hasHorizontalOverflow = await pageA.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);
      await pageA.screenshot({ path: path.join(SCREENSHOT_DIR, `viewport-${vp.name}.png`) });
    }

    // Test mobile drawer open and channel switch at 390x844
    await pageA.setViewportSize({ width: 390, height: 844 });
    await pageA.getByRole('button', { name: 'Toggle navigation drawer' }).click();
    await expect(pageA.locator('#mobile-navigation-drawer')).toBeVisible();
    await pageA.waitForTimeout(250);
    await pageA.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile-drawer-390x844.png') });
    await pageA.locator('#mobile-navigation-drawer').getByRole('button', { name: /build-log/i }).first().click();
    await expect(pageA.locator('body')).toContainText('build-log');

    await contextA.close();
    await contextB.close();
  });
});
