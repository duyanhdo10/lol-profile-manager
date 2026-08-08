import { expect, test, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CatalogSnapshot } from '../../src/shared/models';

let electronApp: ElectronApplication;
let page: Page;
let userData = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  userData = await mkdtemp(path.join(os.tmpdir(), 'lpm-e2e-'));
  const snapshot: CatalogSnapshot = {
    schemaVersion: 5,
    version: '16.15.8024387+branch.release',
    patch: '16.15',
    fetchedAt: new Date().toISOString(),
    fromCache: false,
    stale: false,
    compatible: true,
    locale: 'en_US',
    requestedLocale: 'en_US',
    fallbacks: [],
    icons: [
      {
        id: 7,
        kind: 'icon',
        name: 'Offline icon',
        imageUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==',
        source: 'CommunityDragon',
        sourceVersion: '16.15',
        legacy: false,
        ownership: 'unknown',
        compatibility: 'unknown',
        visibility: ['Transient'],
      },
    ],
    backgrounds: [],
    titles: Array.from({ length: 355 }, (_, index) => ({
      contentId: `title-${index + 1}`,
      itemId: 10_000 + index,
      name: `Offline title ${index + 1}`,
      imageUrl: '',
      source: 'CommunityDragon',
      sourceVersion: '16.15',
      ownership: 'unowned',
      compatibility: 'unknown',
      visibility: ['Profile/hovercard'],
      tier: 'GOLD',
      category: 'Imagination',
    })),
    tokens: Array.from({ length: 400 }, (_, index) => ({
      id: 20_000 + index,
      name: `Offline token ${index + 1}`,
      imageUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==',
      source: 'CommunityDragon',
      sourceVersion: '16.15',
      ownership: 'unknown',
      compatibility: 'unknown',
      visibility: ['Profile/hovercard'],
      tier: 'GOLD',
      category: 'Imagination',
    })),
    regalia: Array.from({ length: 35 }, (_, index) => ({
      id: String(index + 1),
      contentId: `banner-${index + 1}`,
      regaliaType: 'kBanner',
      name: `Offline banner ${index + 1}`,
      imageUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==',
      source: 'CommunityDragon',
      sourceVersion: '16.15',
      ownership: 'unknown',
      compatibility: 'unknown',
      visibility: ['Profile/hovercard'],
    })),
    rankEmblems: [
      {
        tier: 'GOLD',
        name: 'Gold ranked emblem',
        imageUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==',
        source: 'CommunityDragon',
        sourceVersion: '16.15',
        ownership: 'unknown',
        compatibility: 'unknown',
        visibility: ['Profile/hovercard'],
      },
    ],
  };
  await writeFile(path.join(userData, 'catalog-snapshot.json'), JSON.stringify(snapshot));
  await writeFile(path.join(userData, 'compatibility.json'), '[]');
  electronApp = await electron.launch({
    // CI and sandboxed Windows workers may not expose a usable GPU process.
    args: ['.', '--disable-gpu', '--in-process-gpu', '--no-sandbox'],
    env: {
      ...process.env,
      LPM_USER_DATA: userData,
      LPM_DISABLE_LCU: '1',
      LPM_DISABLE_UPDATER: '1',
      LPM_DISABLE_GPU: '1',
    },
  });
  page = await electronApp.firstWindow();
  await page.waitForSelector('[data-testid="app-root"]');
});

test.afterAll(async () => {
  await electronApp?.close();
  if (userData && process.env['LPM_E2E_KEEP'] !== '1') {
    await rm(userData, { recursive: true, force: true });
  } else if (userData) {
    console.info(`Preserved E2E data: ${userData}`);
  }
});

test('starts with one hardened React window and a typed bridge', async () => {
  expect(electronApp.windows()).toHaveLength(1);
  expect(await page.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe(
    'undefined',
  );
  expect(await page.evaluate(() => typeof (window as unknown as { process?: unknown }).process)).toBe(
    'undefined',
  );
  expect(await page.evaluate(() => typeof window.lpm.readProfile)).toBe('function');
  expect(await page.evaluate(() => typeof window.lpm.checkForUpdates)).toBe('function');
  expect(await page.evaluate(() => window.lpm.getUpdateState())).toEqual({ status: 'disabled' });
  await expect.poll(() => page.evaluate(() => window.lpm.getConnectionState())).toBe('disconnected');
  await expect(page.getByRole('heading', { name: 'Profile overview' })).toBeVisible();
});

for (const viewport of [
  { width: 1920, height: 991 },
  { width: 1080, height: 720 },
]) {
  test(`showcase grids reach their last item at ${viewport.width}x${viewport.height}`, async () => {
    await page.setViewportSize(viewport);
    await page.getByRole('link', { name: 'Showcase' }).click();

    const titleGrid = page.getByTestId('titles-grid');
    await titleGrid.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(page.getByRole('button', { name: /Offline title 355/ })).toBeVisible();

    await page.getByRole('tab', { name: /Tokens/ }).click();
    const tokenGrid = page.getByTestId('tokens-grid');
    await tokenGrid.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(page.getByRole('button', { name: /Offline token 400/ })).toBeVisible();

    await page.getByRole('tab', { name: 'Banner' }).click();
    const bannerGrid = page.getByTestId('banners-grid');
    await bannerGrid.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(page.getByRole('button', { name: /Offline banner 35/ })).toBeVisible();
  });
}

test('browses an offline icon catalog and keeps unknown items selectable', async () => {
  await page.getByRole('link', { name: 'Profile icon' }).click();
  const item = page.getByRole('button', { name: /Offline icon/ });
  await expect(item).toBeVisible();
  await expect(item).toContainText('unknown');
  await item.click();
  await expect(page.getByText('1 profile field ready for review')).toBeVisible();
});

test('uses routed Showcase tabs and allows unknown assets', async () => {
  await page.getByRole('link', { name: 'Showcase' }).click();
  const title = page.getByRole('button', { name: /Offline title 1 / });
  await title.click();
  await expect(page.getByRole('heading', { name: 'Offline title' })).toBeVisible();
  await page.getByRole('tab', { name: /Tokens/ }).click();
  await page.getByRole('button', { name: /Offline token 1 / }).click();
  await expect(page.getByRole('tab', { name: /Tokens/ })).toContainText('1/3');
  await page.getByRole('tab', { name: 'Banner' }).click();
  await page.getByRole('button', { name: /Offline banner 1 / }).click();
  await expect(page.getByText('Offline banner 1').first()).toBeVisible();
});
