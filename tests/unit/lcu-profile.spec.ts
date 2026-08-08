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
        '/lol-challenges/v1/summary-player-data/local-player': { preferences: {} },
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
  });
});
