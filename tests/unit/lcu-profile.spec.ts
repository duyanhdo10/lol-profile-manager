import { describe, expect, it, vi } from 'vitest';
import { LcuClient, parseRankedStats, parseRegaliaAppearance } from '../../electron/lcu-client';

describe('LCU profile parsing', () => {
  it('parses Solo/Duo, Flex, and TFT rank entries from queueMap and arrays', () => {
    const result = parseRankedStats({
      queueMap: {
        RANKED_SOLO_5x5: {
          tier: 'GOLD',
          division: 'II',
          leaguePoints: 42,
          wins: 12,
          losses: 8,
        },
        RANKED_FLEX_SR: { tier: 'EMERALD', division: 'IV' },
      },
      queues: [{ queueType: 'RANKED_TFT', tier: 'PLATINUM', division: 'I' }],
    });

    expect(result.RANKED_SOLO_5x5).toMatchObject({
      queue: 'RANKED_SOLO_5x5',
      tier: 'GOLD',
      division: 'II',
      leaguePoints: 42,
    });
    expect(result.RANKED_FLEX_SR?.tier).toBe('EMERALD');
    expect(result.RANKED_TFT?.tier).toBe('PLATINUM');
  });

  it('preserves the LCU blank banner mode', () => {
    expect(
      parseRegaliaAppearance({
        preferredCrestType: 'ranked',
        preferredBannerType: 'blank',
        selectedPrestigeCrest: 20,
      }),
    ).toEqual({
      preferredCrestType: 'ranked',
      preferredBannerType: 'blank',
      selectedPrestigeCrest: 20,
    });
  });

  it('keeps profile loading successful when ranked stats are unavailable', async () => {
    const client = new LcuClient('C:/project');
    vi.spyOn(client, 'request').mockImplementation(async (_method, endpoint) => {
      if (endpoint === '/lol-ranked/v1/current-ranked-stats') throw new Error('not ready');
      const bodies: Record<string, unknown> = {
        '/lol-summoner/v1/current-summoner': {
          profileIconId: 7,
          gameName: 'Player',
          tagLine: 'SEA',
          summonerLevel: 123,
        },
        '/lol-summoner/v1/current-summoner/summoner-profile': { backgroundSkinId: 1001 },
        '/lol-chat/v1/me': { icon: 7, statusMessage: 'Ready', lol: {} },
        '/lol-challenges/v1/summary-player-data/local-player': {
          title: { contentId: 'current-title', itemId: 50200104 },
          topChallenges: [{ id: 101101 }, { id: 101106 }, { id: 101304 }],
          bannerId: '22',
        },
        '/lol-regalia/v2/current-summoner/regalia': {
          preferredCrestType: 'prestige',
          preferredBannerType: 'blank',
          selectedPrestigeCrest: 10,
          crestType: 'ranked',
          bannerType: 'blank',
          highestRank: 'GOLD',
          lastSeasonHighestRank: 'SILVER',
          summonerLevel: 123,
        },
      };
      return { status: 200, body: bodies[endpoint] };
    });

    const profile = await client.readProfile();
    expect(profile.identity).toEqual({ gameName: 'Player', tagLine: 'SEA', accountLevel: 123 });
    expect(profile.rankedQueues).toEqual({
      RANKED_SOLO_5x5: null,
      RANKED_FLEX_SR: null,
      RANKED_TFT: null,
    });
    expect(profile.regalia.preferredBannerType).toBe('blank');
    expect(profile.regaliaContext).toEqual({
      resolvedCrest: 'ranked',
      resolvedBanner: 'blank',
      accountLevel: 123,
      highestRank: 'GOLD',
      lastSeasonHighestRank: 'SILVER',
    });
    expect(profile.challengeShowcase).toEqual({
      titleContentId: 'current-title',
      tokenIds: [101101, 101106, 101304],
      bannerAccent: '22',
    });
  });

  it('reads owned challenge, title, and banner inventory from current LCU endpoints', async () => {
    const client = new LcuClient('C:/project');
    vi.spyOn(client, 'request').mockImplementation(async (_method, endpoint) => {
      const bodies: Record<string, unknown> = {
        '/lol-inventory/v2/inventory/SUMMONER_ICON': [],
        '/lol-summoner/v1/current-summoner': {},
        '/lol-challenges/v1/challenges/local-player': {
          101101: { id: 101101, currentLevel: 'CHALLENGER' },
          101102: { id: 101102, currentLevel: 'NONE' },
          101108: { id: 101108, currentLevel: 'GRANDMASTER' },
        },
        '/lol-challenges/v2/titles/local-player': [{ contentId: 'owned-title', itemId: 50200104 }],
        '/lol-inventory/v2/inventory/REGALIA_BANNER': [
          { itemId: 16, owned: false, ownershipType: 'NONE' },
          { itemId: 22, owned: true, ownershipType: 'OWNED' },
          { itemId: 24, owned: false, ownershipType: 'OWNED' },
        ],
      };
      return { status: 200, body: bodies[endpoint] };
    });

    await expect(client.readInventory()).resolves.toEqual({
      iconIds: [],
      skinIds: null,
      titleContentIds: ['owned-title'],
      challengeIds: [101101, 101108],
      regaliaContentIds: ['22', '24'],
    });
  });
});
