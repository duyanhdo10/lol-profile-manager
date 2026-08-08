import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CatalogService,
  cdragonAssetUrl,
  exactPatch,
  loadLocalizedFile,
  normalizeCatalog,
  overlayCompatibility,
  overlayOwnership,
  rankEmblemUrl,
} from '../../electron/catalog-service';
import type { CatalogInputs } from '../../electron/catalog-service';
import type { CatalogItem, CatalogSnapshot, InventorySnapshot } from '../../src/shared/models';

const roots: string[] = [];
const inventory: InventorySnapshot = {
  iconIds: null,
  skinIds: null,
  titleContentIds: null,
  challengeIds: null,
  regaliaContentIds: null,
};
const item: CatalogItem = {
  id: 7,
  kind: 'icon',
  name: 'Seven',
  imageUrl: 'https://example.invalid/7.png',
  source: 'CommunityDragon',
  sourceVersion: '16.15.8024387+branch.releases-16-15.content.release',
  legacy: false,
  ownership: 'unknown',
  compatibility: 'unknown',
  visibility: ['Transient'],
};

function inputs(overrides: Partial<CatalogInputs> = {}): CatalogInputs {
  return {
    patch: '16.15',
    sourceVersion: '16.15.8024387+branch.releases-16-15.content.release',
    fetchedAt: '2026-08-07T00:00:00.000Z',
    icons: [
      {
        id: 7,
        title: 'Lucky',
        yearReleased: 2020,
        imagePath: '/lol-game-data/assets/v1/profile-icons/7.jpg',
      },
    ],
    skins: [
      {
        id: 1001,
        name: 'First Skin',
        championId: 1,
        loadScreenPath: '/lol-game-data/assets/ASSETS/Characters/Annie/skin.jpg',
        splashPath: '/lol-game-data/assets/ASSETS/Characters/Annie/splash.jpg',
      },
    ],
    champions: [{ id: 1, name: 'Annie' }],
    challenges: {
      challenges: {
        '1': { name: 'Imagination' },
        '101': {
          name: 'Token One',
          tags: { parent: '1' },
          levelToIconPath: { GOLD: '/lol-game-data/assets/ASSETS/Challenges/101/GOLD.png' },
          thresholds: { GOLD: { rewards: [{ category: 'TITLE', id: 'title-one' }] } },
        },
      },
    },
    titles: [
      { contentId: 'title-one', itemId: 10103, titleName: 'Creative', titleAcquisitionType: 'kDefault' },
    ],
    regalia: [
      {
        id: '3',
        contentId: 'banner-three',
        isSelectable: true,
        regaliaType: 'kBanner',
        localizedName: 'Banner Three',
        assetPath: '/lol-game-data/assets/ASSETS/Regalia/banner.png',
      },
      { id: '4', contentId: 'none', isSelectable: true, regaliaType: 'kNone' },
      { id: '5', contentId: 'tencent', isSelectable: true, regaliaType: 'kBanner', isTencentOnly: true },
    ],
    ...overrides,
  };
}

function snapshot(patch = '16.15'): CatalogSnapshot {
  return {
    schemaVersion: 5,
    version: `${patch}.8024387+branch.releases-${patch.replace('.', '-')}.content.release`,
    patch,
    fetchedAt: new Date().toISOString(),
    fromCache: false,
    stale: false,
    compatible: true,
    locale: 'en_US',
    requestedLocale: 'en_US',
    fallbacks: [],
    icons: [item],
    backgrounds: [],
    titles: [],
    tokens: [],
    regalia: [],
    rankEmblems: [],
  };
}

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe('CommunityDragon catalog normalization', () => {
  it('falls back one missing Vietnamese file to default without changing other files', async () => {
    const loader = vi.fn(async (locale: 'en_US' | 'vi_VN', file: string) => {
      if (locale === 'vi_VN' && file === 'skins.json') throw new Error('missing');
      return `${locale}:${file}`;
    });
    const result = await loadLocalizedFile('vi_VN', 'skins.json', loader);
    expect(result.data).toBe('en_US:skins.json');
    expect(result.fallback).toEqual({ file: 'skins.json', requestedLocale: 'vi_VN', actualLocale: 'en_US' });
  });

  it('selects an exact patch and maps game-data assets without another host', () => {
    expect(exactPatch('16.15.8024387+branch.release')).toBe('16.15');
    expect(exactPatch('League Client 16.15')).toBe('16.15');
    const url = cdragonAssetUrl('/lol-game-data/assets/ASSETS/Challenges/Icon.PNG', '16.15');
    expect(url).toBe(
      'https://raw.communitydragon.org/16.15/plugins/rcp-be-lol-game-data/global/default/assets/challenges/icon.png',
    );
  });

  it('normalizes all six CommunityDragon payloads and full source metadata', () => {
    const result = normalizeCatalog(inputs());
    expect(result).toMatchObject({ schemaVersion: 5, patch: '16.15', compatible: true });
    expect(result.icons[0]).toMatchObject({ id: 7, name: 'Lucky', year: 2020, source: 'CommunityDragon' });
    expect(result.backgrounds[0]).toMatchObject({ id: 1001, champion: 'Annie' });
    expect(result.tokens[0]).toMatchObject({ id: 101, tier: 'GOLD', category: 'Imagination' });
    expect(result.titles[0]).toMatchObject({ contentId: 'title-one', tier: 'GOLD', category: 'Imagination' });
    expect(result.regalia).toHaveLength(1);
    expect(result.regalia[0]).toMatchObject({ id: '3', contentId: 'banner-three' });
    expect(result.backgrounds[0]?.imageUrl).toContain('/characters/annie/splash.jpg');
    expect(result.rankEmblems.find((item) => item.tier === 'GOLD')?.imageUrl).toBe(
      rankEmblemUrl('GOLD', '16.15'),
    );
  });

  it('accepts object maps and derives a champion from the canonical skin ID', () => {
    const result = normalizeCatalog(
      inputs({
        icons: { '7': { id: 7, title: 'Mapped icon' } },
        skins: { '1001': { id: 1001, name: 'Goth Annie' } },
        champions: { Annie: { id: 1, name: 'Annie' } },
      }),
    );
    expect(result.icons[0]?.name).toBe('Mapped icon');
    expect(result.backgrounds[0]?.champion).toBe('Annie');
  });

  it('falls back to load-screen artwork only when splash artwork is missing', () => {
    const result = normalizeCatalog(
      inputs({
        skins: [
          {
            id: 1001,
            championId: 1,
            loadScreenPath: '/lol-game-data/assets/characters/annie/load.jpg',
          },
        ],
      }),
    );
    expect(result.backgrounds[0]?.imageUrl).toContain('/characters/annie/load.jpg');
  });

  it('rejects a snapshot whose metadata does not match the requested patch', () => {
    expect(() => normalizeCatalog(inputs({ sourceVersion: '16.14.1+release' }))).toThrow(
      /snapshot mismatch/i,
    );
  });

  it('overlays owned, unowned, unknown and exact client-version compatibility', () => {
    expect(overlayOwnership([item], [7])[0]?.ownership).toBe('owned');
    expect(overlayOwnership([item], [8])[0]?.ownership).toBe('unowned');
    expect(overlayOwnership([item], null)[0]?.ownership).toBe('unknown');
    const records = [
      { clientVersion: '16.15.123', field: 'icon' as const, itemId: 7, compatible: false, checkedAt: '' },
    ];
    expect(overlayCompatibility([item], '16.15.123', records)[0]?.compatibility).toBe('not-compatible');
    expect(overlayCompatibility([item], '16.15.124', records)[0]?.compatibility).toBe('unknown');
  });

  it('replaces a v2 cache with v3 and keeps last-known-good v3 when offline', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lpt-catalog-'));
    roots.push(root);
    await writeFile(
      path.join(root, 'catalog-snapshot.json'),
      JSON.stringify({
        schemaVersion: 2,
        version: 'old',
        fetchedAt: new Date().toISOString(),
        icons: [],
        backgrounds: [],
      }),
    );
    const download = vi.fn(async () => snapshot());
    const fresh = await new CatalogService(root, download).get(false, inventory, '16.15.99', []);
    expect(download).toHaveBeenCalledWith('16.15');
    expect(fresh.schemaVersion).toBe(5);

    const cached = await new CatalogService(root, async () => {
      throw new Error('offline');
    }).get(true, inventory, '16.15.99', []);
    expect(cached.fromCache).toBe(true);
    expect(cached.icons[0]?.id).toBe(7);
  });

  it('migrates a v4 snapshot into the English slot of the v5 cache and marks it stale', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lpt-catalog-'));
    roots.push(root);
    const legacy: Partial<CatalogSnapshot> = { ...snapshot(), schemaVersion: 4 };
    delete legacy.rankEmblems;
    await writeFile(path.join(root, 'catalog-snapshot.json'), JSON.stringify(legacy));
    const download = vi.fn(async () => snapshot());
    const result = await new CatalogService(root, download).get(
      { locale: 'en_US', mode: 'cache-first' },
      inventory,
      '16.15.99',
      [],
    );
    expect(download).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      schemaVersion: 5,
      locale: 'en_US',
      requestedLocale: 'en_US',
      stale: true,
      rankEmblems: [],
    });
    const stored = JSON.parse(await readFile(path.join(root, 'catalog-snapshot.json'), 'utf8')) as {
      schemaVersion: number;
      snapshots: { en_US: CatalogSnapshot };
    };
    expect(stored.schemaVersion).toBe(5);
    expect(stored.snapshots.en_US.patch).toBe('16.15');

    const vietnameseOffline = await new CatalogService(root, async () => {
      throw new Error('offline');
    }).get({ locale: 'vi_VN', mode: 'cache-first' }, inventory, '16.15.99', []);
    expect(vietnameseOffline).toMatchObject({
      locale: 'en_US',
      requestedLocale: 'vi_VN',
      fromCache: true,
      stale: true,
    });
    expect(vietnameseOffline.fallbacks).toContainEqual({
      file: 'catalog-cache',
      requestedLocale: 'vi_VN',
      actualLocale: 'en_US',
    });
  });

  it('marks a cache older than 24 hours stale without blocking cache-first display', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lpt-catalog-'));
    roots.push(root);
    const old = { ...snapshot(), fetchedAt: '2026-01-01T00:00:00.000Z' };
    await new CatalogService(root, async () => old).get(true, inventory, '16.15.99', []);
    const download = vi.fn(async () => snapshot());
    const result = await new CatalogService(root, download).get(
      { locale: 'en_US', mode: 'cache-first' },
      inventory,
      '16.15.99',
      [],
    );
    expect(result).toMatchObject({ fromCache: true, stale: true });
    expect(download).not.toHaveBeenCalled();
  });

  it('allows browsing but marks a different-patch offline cache incompatible for Apply', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lpt-catalog-'));
    roots.push(root);
    await new CatalogService(root, async () => snapshot('16.14')).get(true, inventory, '16.14.1', []);
    const cached = await new CatalogService(root, async () => {
      throw new Error('offline');
    }).get(false, inventory, '16.15.1', []);
    expect(cached).toMatchObject({ fromCache: true, compatible: false, stale: true, patch: '16.14' });
  });
});
