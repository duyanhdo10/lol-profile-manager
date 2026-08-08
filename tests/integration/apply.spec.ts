import { describe, expect, it } from 'vitest';
import { ApplyService } from '../../electron/apply-service';
import { LcuError } from '../../electron/lcu-client';
import type {
  CatalogSnapshot,
  ConnectionState,
  InventorySnapshot,
  ProfileDraft,
  ProfileField,
  ProfileState,
} from '../../src/shared/models';

const before: ProfileState = {
  backgroundSkinId: 100,
  iconId: 10,
  challengeShowcase: { titleContentId: 'old-title', tokenIds: [1], bannerAccent: 'old-banner' },
  regalia: {
    preferredCrestType: 'prestige',
    preferredBannerType: 'lastSeasonHighestRank',
    selectedPrestigeCrest: 10,
  },
  statusMessage: 'before',
  rank: { queue: 'RANKED_SOLO_5x5', tier: 'GOLD', division: 'II' },
};
const draft: ProfileDraft = {
  backgroundSkinId: 200,
  iconId: 20,
  challengeShowcase: { titleContentId: 'new-title', tokenIds: [2, 3, 4], bannerAccent: 'new-banner' },
  regalia: { preferredCrestType: 'ranked', preferredBannerType: 'highestRank', selectedPrestigeCrest: 20 },
  statusMessage: 'after',
  rank: { queue: 'RANKED_FLEX_SR', tier: 'EMERALD', division: 'III' },
};
const emptyCatalog: CatalogSnapshot = {
  schemaVersion: 4,
  version: '16.15.1+release',
  patch: '16.15',
  fetchedAt: '',
  fromCache: false,
  stale: false,
  compatible: true,
  locale: 'en_US',
  requestedLocale: 'en_US',
  fallbacks: [],
  icons: [],
  backgrounds: [],
  titles: [],
  tokens: [],
  regalia: [],
};

class FakeLcu {
  calls: Array<{ endpoint: string; body?: Record<string, unknown> }> = [];
  failCalls = new Set<number>();
  state: ConnectionState = 'connected';
  inventory: InventorySnapshot = {
    iconIds: [10, 20],
    skinIds: [100],
    titleContentIds: [],
    challengeIds: [],
    regaliaContentIds: [],
  };
  getState(): ConnectionState {
    return this.state;
  }
  getClientVersion(): string {
    return '16.15.123';
  }
  async readProfile(): Promise<ProfileState> {
    return structuredClone(before);
  }
  async readInventory(): Promise<InventorySnapshot> {
    return this.inventory;
  }
  async request<T>(
    _method: string,
    endpoint: string,
    body?: Record<string, unknown>,
  ): Promise<{ status: number; body: T }> {
    this.calls.push({ endpoint, body });
    if (this.failCalls.has(this.calls.length)) throw new LcuError(`failure ${this.calls.length}`, 400);
    return { status: 204, body: null as T };
  }
}

function service(lcu: FakeLcu, catalog = emptyCatalog) {
  const records: Array<{ field: ProfileField; itemId: string | number; compatible: boolean }> = [];
  return {
    apply: new ApplyService(
      lcu,
      {
        record: async (_version, field, itemId, compatible) => {
          records.push({ field, itemId, compatible });
        },
      },
      async () => catalog,
    ),
    records,
  };
}

describe('transactional profile apply', () => {
  it('applies background, icon, challenge showcase, regalia, status and rank in order', async () => {
    const lcu = new FakeLcu();
    const result = await service(lcu).apply.apply(draft);
    expect(result.succeeded).toBe(true);
    expect(lcu.calls.map((call) => call.endpoint)).toEqual([
      '/lol-summoner/v1/current-summoner/summoner-profile',
      '/lol-summoner/v1/current-summoner/icon',
      '/lol-challenges/v1/update-player-preferences',
      '/lol-regalia/v2/current-summoner/regalia',
      '/lol-chat/v1/me',
      '/lol-chat/v1/me',
    ]);
    expect(lcu.calls[2]?.body).toEqual({
      title: 'new-title',
      challengeIds: [2, 3, 4],
      bannerAccent: 'new-banner',
    });
  });

  it.each([1, 2, 3, 4, 5, 6])(
    'stops when field call %i fails and rolls completed fields back in reverse',
    async (failureCall) => {
      const lcu = new FakeLcu();
      lcu.failCalls.add(failureCall);
      const result = await service(lcu).apply.apply(draft);
      expect(result.succeeded).toBe(false);
      expect(result.steps.filter((step) => step.succeeded)).toHaveLength(failureCall - 1);
      expect(result.steps.filter((step) => step.rollbackAttempted)).toHaveLength(failureCall - 1);
      expect(result.steps.slice(failureCall).every((step) => !step.attempted)).toBe(true);
    },
  );

  it('marks every selected showcase item not compatible after a 4xx rejection', async () => {
    const lcu = new FakeLcu();
    lcu.failCalls.add(3);
    const { apply, records } = service(lcu);
    await apply.apply(draft);
    expect(
      records
        .filter((record) => record.field === 'challengeShowcase' && !record.compatible)
        .map((record) => record.itemId),
    ).toEqual(['new-title', 2, 3, 4, 'new-banner']);
  });

  it('warns about unowned and unknown showcase selections without blocking review', async () => {
    const lcu = new FakeLcu();
    const warningCatalog: CatalogSnapshot = {
      ...emptyCatalog,
      titles: [
        {
          contentId: 'new-title',
          itemId: 1,
          name: 'Unowned title',
          imageUrl: '',
          source: 'CommunityDragon',
          sourceVersion: emptyCatalog.version,
          ownership: 'unowned',
          compatibility: 'unknown',
          visibility: ['Profile/hovercard'],
        },
      ],
      tokens: [
        {
          id: 2,
          name: 'Unknown token',
          imageUrl: '',
          source: 'CommunityDragon',
          sourceVersion: emptyCatalog.version,
          ownership: 'unknown',
          compatibility: 'unknown',
          visibility: ['Profile/hovercard'],
        },
      ],
    };
    const preview = await service(lcu, warningCatalog).apply.preview(draft);
    expect(preview.draft).toEqual(draft);
    expect(preview.warnings.some((warning) => /Unowned title is unowned/.test(warning.message))).toBe(true);
    expect(preview.warnings.some((warning) => /Unknown token is unknown/.test(warning.message))).toBe(true);
  });

  it('reports rollback failure and preserves per-field information', async () => {
    const lcu = new FakeLcu();
    lcu.failCalls = new Set([3, 4]);
    const result = await service(lcu).apply.apply(draft);
    expect(result.rollbackAttempted).toBe(true);
    expect(result.rollbackSucceeded).toBe(false);
    expect(
      result.steps.some(
        (step) => step.rollbackSucceeded === false && step.error?.includes('Rollback failed'),
      ),
    ).toBe(true);
  });

  it('treats a disconnect between fields as a transaction failure', async () => {
    const lcu = new FakeLcu();
    const original = lcu.request.bind(lcu);
    lcu.request = async <T>(method: string, endpoint: string, body?: Record<string, unknown>) => {
      if (lcu.calls.length === 1) {
        lcu.state = 'disconnected';
        throw new Error('League Client disconnected.');
      }
      return original<T>(method, endpoint, body);
    };
    const result = await service(lcu).apply.apply(draft);
    expect(result.succeeded).toBe(false);
    expect(result.steps[1]?.error).toMatch(/disconnected/);
  });

  it('refuses Apply when only a different-patch browse cache is available', async () => {
    const lcu = new FakeLcu();
    const mismatched = { ...emptyCatalog, patch: '16.14', compatible: false };
    await expect(service(lcu, mismatched).apply.apply(draft)).rejects.toThrow(/does not match/);
    expect(lcu.calls).toHaveLength(0);
  });
});
