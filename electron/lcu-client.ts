import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import type {
  ChallengeShowcase,
  ClientLocale,
  ConnectionState,
  InventorySnapshot,
  ProfileState,
  RankAppearance,
  RankedQueueSnapshot,
  RankedQueueSnapshotMap,
  RegaliaAppearance,
  RegaliaContext,
  Queue,
  Tier,
  Division,
} from '../src/shared/models';

interface Credentials {
  port: number;
  password: string;
  protocol: 'https';
}

interface LcuResponse<T> {
  status: number;
  body: T;
}

interface ChatMe {
  icon?: number;
  statusMessage?: string;
  lol?: {
    rankedLeagueQueue?: string;
    rankedLeagueTier?: string;
    rankedLeagueDivision?: string;
  };
}

interface LoginSession {
  connected?: boolean;
  state?: string;
}

interface ChallengePreferencesPayload {
  title?: string | { contentId?: string; itemId?: number };
  challengeIds?: number[];
  bannerAccent?: string;
  bannerId?: string;
  topChallenges?: Array<{ id?: number }>;
}

interface ChallengeSummary extends ChallengePreferencesPayload {
  preferences?: ChallengePreferencesPayload;
  challenges?: unknown;
}

interface RegaliaResponse {
  preferredCrestType?: string;
  preferredBannerType?: string;
  selectedPrestigeCrest?: number;
  preferences?: RegaliaResponse;
  crestType?: string;
  bannerType?: string;
  highestRank?: string;
  highestPreviousSeasonEndTier?: string;
  highestRankedEntry?: unknown;
  lastSeasonHighestRank?: string;
  summonerLevel?: number;
}

const QUEUES: Queue[] = ['RANKED_SOLO_5x5', 'RANKED_FLEX_SR', 'RANKED_TFT'];
const TIERS: Tier[] = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
];
const DIVISIONS: Division[] = ['I', 'II', 'III', 'IV'];

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function rankedEntry(value: unknown, queueHint?: string): RankedQueueSnapshot | null {
  const entry = record(value);
  if (!entry) return null;
  const queue = String(entry['queueType'] ?? entry['queue'] ?? queueHint ?? '');
  const tier = String(entry['tier'] ?? '').toUpperCase();
  const division = String(entry['division'] ?? '').toUpperCase();
  if (!QUEUES.includes(queue as Queue) || !TIERS.includes(tier as Tier)) return null;
  const normalizedDivision = DIVISIONS.includes(division as Division) ? (division as Division) : 'I';
  return {
    queue: queue as Queue,
    tier: tier as Tier,
    division: normalizedDivision,
    ...(typeof entry['leaguePoints'] === 'number' ? { leaguePoints: entry['leaguePoints'] } : {}),
    ...(typeof entry['wins'] === 'number' ? { wins: entry['wins'] } : {}),
    ...(typeof entry['losses'] === 'number' ? { losses: entry['losses'] } : {}),
  };
}

export function parseRankedStats(value: unknown): RankedQueueSnapshotMap {
  const result: RankedQueueSnapshotMap = {
    RANKED_SOLO_5x5: null,
    RANKED_FLEX_SR: null,
    RANKED_TFT: null,
  };
  const root = record(value);
  const queueMap = record(root?.['queueMap']);
  for (const [queue, entry] of Object.entries(queueMap ?? {})) {
    const parsed = rankedEntry(entry, queue);
    if (parsed) result[parsed.queue] = parsed;
  }
  const entries = [
    ...(Array.isArray(root?.['queues']) ? root['queues'] : []),
    ...(Array.isArray(root?.['rankedEntries']) ? root['rankedEntries'] : []),
  ];
  for (const entry of entries) {
    const parsed = rankedEntry(entry);
    if (parsed) result[parsed.queue] = parsed;
  }
  return result;
}

export function parseRegaliaAppearance(value: RegaliaResponse): RegaliaAppearance {
  const preferences = value.preferences ?? value;
  const crest = preferences.preferredCrestType;
  const banner = preferences.preferredBannerType;
  return {
    preferredCrestType: crest === 'ranked' ? 'ranked' : 'prestige',
    preferredBannerType: banner === 'blank' || banner === 'highestRank' ? banner : 'lastSeasonHighestRank',
    selectedPrestigeCrest:
      Number.isSafeInteger(preferences.selectedPrestigeCrest) &&
      Number(preferences.selectedPrestigeCrest) >= 0
        ? Math.min(255, Number(preferences.selectedPrestigeCrest))
        : 0,
  };
}

export class LcuError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class LcuClient extends EventEmitter {
  private credentials: Credentials | null = null;
  private timer: NodeJS.Timeout | null = null;
  private state: ConnectionState = 'connecting';
  private version = 'unknown';
  private hasConnected = false;

  constructor(private readonly projectRoot: string) {
    super();
  }

  start(): void {
    if (this.timer) return;
    if (process.env['LPM_DISABLE_LCU'] === '1') {
      this.setState('disconnected');
      return;
    }
    void this.poll();
    this.timer = setInterval(() => void this.poll(), 2_500);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getState(): ConnectionState {
    return this.state;
  }

  getClientVersion(): string {
    return this.version;
  }

  async getClientLocale(): Promise<ClientLocale | null> {
    if (!this.credentials || this.state !== 'connected') return null;
    const response = await this.requestWithCredentials<ClientLocale>(
      this.credentials,
      'GET',
      '/riotclient/region-locale',
    );
    return typeof response.body?.locale === 'string' ? response.body : null;
  }

  async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>,
    maxResponseBytes = 5_000_000,
  ): Promise<LcuResponse<T>> {
    if (!this.credentials || this.state !== 'connected')
      throw new LcuError('League Client is not connected.', 503);
    return await this.requestWithCredentials<T>(this.credentials, method, endpoint, body, maxResponseBytes);
  }

  private async requestWithCredentials<T>(
    credentials: Credentials,
    method: string,
    endpoint: string,
    body?: Record<string, unknown>,
    maxResponseBytes = 5_000_000,
  ): Promise<LcuResponse<T>> {
    if (!endpoint.startsWith('/lol-') && endpoint !== '/riotclient/region-locale') {
      throw new LcuError('Endpoint is not permitted.', 400);
    }
    const payload = body === undefined || method === 'GET' ? undefined : JSON.stringify(body);
    return await new Promise<LcuResponse<T>>((resolve, reject) => {
      const request = https.request(
        {
          hostname: '127.0.0.1',
          port: credentials.port,
          path: endpoint,
          method,
          rejectUnauthorized: false,
          timeout: 10_000,
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${Buffer.from(`riot:${credentials.password}`).toString('base64')}`,
            ...(payload
              ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
              : {}),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          let length = 0;
          response.on('data', (chunk: Buffer) => {
            length += chunk.length;
            if (length <= maxResponseBytes) chunks.push(chunk);
            else
              request.destroy(
                new Error(`LCU response exceeded ${Math.floor(maxResponseBytes / 1_000_000)} MB.`),
              );
          });
          response.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let parsed: unknown = null;
            if (text) {
              try {
                parsed = JSON.parse(text);
              } catch {
                parsed = text;
              }
            }
            const status = response.statusCode ?? 500;
            if (status >= 200 && status < 300) resolve({ status, body: parsed as T });
            else
              reject(
                new LcuError(
                  typeof parsed === 'string' ? parsed : `LCU rejected ${method} ${endpoint} (${status}).`,
                  status,
                ),
              );
          });
        },
      );
      request.on('timeout', () => request.destroy(new Error('LCU request timed out.')));
      request.on('error', reject);
      if (payload) request.write(payload);
      request.end();
    });
  }

  async readProfile(): Promise<ProfileState> {
    const [summoner, profile, chat, challenges, regalia, rankedStats] = await Promise.all([
      this.request<{
        profileIconId?: number;
        gameName?: string;
        tagLine?: string;
        displayName?: string;
        summonerLevel?: number;
      }>('GET', '/lol-summoner/v1/current-summoner'),
      this.request<{ backgroundSkinId?: number }>(
        'GET',
        '/lol-summoner/v1/current-summoner/summoner-profile',
      ),
      this.request<ChatMe>('GET', '/lol-chat/v1/me'),
      this.request<ChallengeSummary>('GET', '/lol-challenges/v1/summary-player-data/local-player'),
      this.request<RegaliaResponse>('GET', '/lol-regalia/v2/current-summoner/regalia'),
      this.request<unknown>('GET', '/lol-ranked/v1/current-ranked-stats')
        .then((response) => response.body)
        .catch(() => null),
    ]);
    const lol = chat.body.lol;
    const rank =
      lol?.rankedLeagueQueue && lol.rankedLeagueTier && lol.rankedLeagueDivision
        ? ({
            queue: lol.rankedLeagueQueue,
            tier: lol.rankedLeagueTier,
            division: lol.rankedLeagueDivision,
          } as RankAppearance)
        : null;
    return {
      identity: {
        gameName: summoner.body.gameName?.trim() || summoner.body.displayName?.trim() || '',
        tagLine: summoner.body.tagLine?.trim() || '',
        accountLevel: Number.isSafeInteger(summoner.body.summonerLevel)
          ? Number(summoner.body.summonerLevel)
          : 0,
      },
      iconId: typeof chat.body.icon === 'number' ? chat.body.icon : (summoner.body.profileIconId ?? null),
      backgroundSkinId: profile.body.backgroundSkinId ?? null,
      challengeShowcase: this.challengePreferences(challenges.body),
      regalia: this.regaliaPreferences(regalia.body),
      statusMessage: chat.body.statusMessage ?? '',
      rank,
      rankedQueues: parseRankedStats(rankedStats),
      regaliaContext: this.regaliaContext(regalia.body, rankedStats, summoner.body.summonerLevel),
    };
  }

  async readInventory(): Promise<InventorySnapshot> {
    let iconIds: number[] | null = null;
    let skinIds: number[] | null = null;
    let titleContentIds: string[] | null = null;
    let challengeIds: number[] | null = null;
    let regaliaContentIds: string[] | null = null;
    try {
      const icons = await this.request<Array<{ itemId?: number; id?: number }>>(
        'GET',
        '/lol-inventory/v2/inventory/SUMMONER_ICON',
      );
      iconIds = icons.body
        .map((item) => item.itemId ?? item.id)
        .filter((id): id is number => typeof id === 'number');
    } catch {
      /* unknown inventory is intentionally non-blocking */
    }
    try {
      const summoner = await this.request<{ summonerId?: number }>(
        'GET',
        '/lol-summoner/v1/current-summoner',
      );
      if (summoner.body.summonerId) {
        const champions = await this.request<
          Array<{ skins?: Array<{ id?: number; ownership?: { owned?: boolean } }> }>
        >(
          'GET',
          `/lol-champions/v1/inventories/${summoner.body.summonerId}/champions`,
          undefined,
          25_000_000,
        );
        skinIds = champions.body
          .flatMap((champion) => champion.skins ?? [])
          .filter((skin) => skin.ownership?.owned)
          .map((skin) => skin.id)
          .filter((id): id is number => typeof id === 'number');
      }
    } catch {
      /* unknown inventory is intentionally non-blocking */
    }
    try {
      const challenges = await this.request<unknown>('GET', '/lol-challenges/v1/challenges/local-player');
      challengeIds = this.extractOwnedChallengeIds(challenges.body);
    } catch {
      /* unknown challenge ownership is intentionally non-blocking */
    }
    try {
      const titles = await this.request<unknown>('GET', '/lol-challenges/v2/titles/local-player');
      titleContentIds = this.extractStrings(titles.body, ['contentId', 'titleId', 'id']);
    } catch {
      /* unknown title ownership is intentionally non-blocking */
    }
    try {
      const regalia = await this.request<
        Array<{ itemId?: string | number; owned?: boolean; ownershipType?: string }>
      >('GET', '/lol-inventory/v2/inventory/REGALIA_BANNER');
      regaliaContentIds = [
        ...new Set(
          regalia.body.flatMap((item): string[] => {
            if (item.owned !== true && item.ownershipType !== 'OWNED') return [];
            return typeof item.itemId === 'string' || typeof item.itemId === 'number'
              ? [String(item.itemId)]
              : [];
          }),
        ),
      ];
    } catch {
      /* unknown regalia ownership is intentionally non-blocking */
    }
    return { iconIds, skinIds, titleContentIds, challengeIds, regaliaContentIds };
  }

  private async poll(): Promise<void> {
    try {
      const contents = await fs.readFile(await this.lockfilePath(), 'utf8');
      const parts = contents.trim().split(':');
      const port = Number(parts[2]);
      if (parts.length < 5 || !Number.isInteger(port) || !parts[3] || parts[4] !== 'https') {
        this.credentials = null;
        this.setState('incompatible');
        return;
      }
      const nextCredentials: Credentials = { port, password: parts[3], protocol: 'https' };
      const credentialsChanged =
        this.credentials?.port !== nextCredentials.port ||
        this.credentials.password !== nextCredentials.password;
      this.credentials = nextCredentials;
      if (this.state !== 'connected' || credentialsChanged) {
        try {
          const [version, login] = await Promise.all([
            this.requestWithCredentials<string>(nextCredentials, 'GET', '/lol-patch/v1/game-version'),
            this.requestWithCredentials<LoginSession>(nextCredentials, 'GET', '/lol-login/v1/session'),
          ]);
          if (login.body.connected !== true || login.body.state !== 'SUCCEEDED') {
            this.version = 'unknown';
            this.setState('connecting');
            return;
          }
          // The patch service becomes available before the authenticated profile
          // services during client startup. Do not announce a usable connection
          // until every service required by readProfile is ready as well.
          await Promise.all([
            this.requestWithCredentials<unknown>(nextCredentials, 'GET', '/lol-summoner/v1/current-summoner'),
            this.requestWithCredentials<unknown>(
              nextCredentials,
              'GET',
              '/lol-summoner/v1/current-summoner/summoner-profile',
            ),
            this.requestWithCredentials<unknown>(nextCredentials, 'GET', '/lol-chat/v1/me'),
            this.requestWithCredentials<unknown>(
              nextCredentials,
              'GET',
              '/lol-challenges/v1/summary-player-data/local-player',
            ),
            this.requestWithCredentials<unknown>(
              nextCredentials,
              'GET',
              '/lol-regalia/v2/current-summoner/regalia',
            ),
          ]);
          this.version = String(version.body || 'unknown');
          const reconnect = this.hasConnected;
          this.hasConnected = true;
          this.setState('connected');
          if (reconnect) this.emit('reconnected');
        } catch (error: unknown) {
          this.version = 'unknown';
          if (
            error instanceof LcuError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 401
          ) {
            this.setState('incompatible');
          } else {
            this.setState('connecting');
          }
        }
      }
    } catch {
      this.credentials = null;
      this.version = 'unknown';
      this.setState('disconnected');
    }
  }

  private challengePreferences(value: ChallengeSummary): ChallengeShowcase {
    const preferences = value.preferences ?? value;
    const title = preferences.title;
    const titleContentId =
      typeof title === 'string'
        ? title
        : typeof title === 'object' && title !== null && typeof title.contentId === 'string'
          ? title.contentId
          : undefined;
    const challengeIds = Array.isArray(preferences.challengeIds)
      ? preferences.challengeIds
      : Array.isArray(preferences.topChallenges)
        ? preferences.topChallenges.map((challenge) => challenge.id)
        : [];
    const bannerAccent = preferences.bannerAccent ?? preferences.bannerId;
    return {
      ...(titleContentId ? { titleContentId } : {}),
      tokenIds: challengeIds
        .filter((id): id is number => Number.isSafeInteger(id) && Number(id) >= 0)
        .slice(0, 3),
      ...(typeof bannerAccent === 'string' && bannerAccent ? { bannerAccent } : {}),
    };
  }

  private regaliaPreferences(value: RegaliaResponse): RegaliaAppearance {
    return parseRegaliaAppearance(value);
  }

  private regaliaContext(
    value: RegaliaResponse,
    rankedStats: unknown,
    accountLevel?: number,
  ): RegaliaContext {
    const preferences = this.regaliaPreferences(value);
    const stats = record(rankedStats);
    const highestEntry = rankedEntry(stats?.['highestRankedEntry']) ?? rankedEntry(value.highestRankedEntry);
    const queues = parseRankedStats(rankedStats);
    const highestRank =
      highestEntry?.tier ??
      TIERS.findLast((tier) => Object.values(queues).some((entry) => entry?.tier === tier)) ??
      null;
    const reportedHighest = String(value.highestRank ?? '').toUpperCase();
    const previous = String(
      stats?.['highestPreviousSeasonEndTier'] ??
        value.highestPreviousSeasonEndTier ??
        value.lastSeasonHighestRank ??
        '',
    ).toUpperCase();
    return {
      resolvedCrest:
        value.crestType === 'ranked' || value.crestType === 'prestige'
          ? value.crestType
          : preferences.preferredCrestType,
      resolvedBanner:
        value.bannerType === 'blank' ||
        value.bannerType === 'highestRank' ||
        value.bannerType === 'lastSeasonHighestRank'
          ? value.bannerType
          : preferences.preferredBannerType,
      accountLevel: Number.isSafeInteger(value.summonerLevel)
        ? Number(value.summonerLevel)
        : Number.isSafeInteger(accountLevel)
          ? Number(accountLevel)
          : 0,
      highestRank: TIERS.includes(reportedHighest as Tier) ? (reportedHighest as Tier) : highestRank,
      lastSeasonHighestRank: TIERS.includes(previous as Tier) ? (previous as Tier) : null,
    };
  }

  private extractOwnedChallengeIds(value: unknown): number[] {
    const entries = Array.isArray(value)
      ? value
      : typeof value === 'object' && value !== null
        ? Object.entries(value as Record<string, unknown>).map(([key, entry]) =>
            typeof entry === 'object' && entry !== null ? { key, ...entry } : { key },
          )
        : [];
    return [
      ...new Set(
        entries.flatMap((entry): number[] => {
          if (typeof entry === 'number' && Number.isSafeInteger(entry)) return [entry];
          if (typeof entry !== 'object' || entry === null) return [];
          const record = entry as Record<string, unknown>;
          const currentLevel = record['currentLevel'];
          if (typeof currentLevel !== 'string' || !currentLevel || currentLevel === 'NONE') return [];
          const id = record['id'] ?? record['challengeId'] ?? record['key'];
          const parsed = typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id;
          return typeof parsed === 'number' && Number.isSafeInteger(parsed) ? [parsed] : [];
        }),
      ),
    ];
  }

  private extractStrings(value: unknown, keys: string[]): string[] {
    const root =
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    const entries = Array.isArray(value)
      ? value
      : Array.isArray(root?.['titles'])
        ? root['titles']
        : Array.isArray(root?.['items'])
          ? root['items']
          : [];
    return [
      ...new Set(
        entries.flatMap((entry): string[] => {
          if (typeof entry === 'string') return [entry];
          if (typeof entry !== 'object' || entry === null) return [];
          const record = entry as Record<string, unknown>;
          for (const key of keys) {
            const candidate = record[key];
            if (typeof candidate === 'string' && candidate) return [candidate];
          }
          return [];
        }),
      ),
    ];
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.emit('state', next);
  }

  private async lockfilePath(): Promise<string> {
    try {
      const configured = (
        await fs.readFile(path.join(this.projectRoot, 'config', 'clientPath.txt'), 'utf8')
      ).trim();
      if (configured) return path.join(configured, 'lockfile');
    } catch {
      /* use the standard Windows location */
    }
    return path.join(process.env['SystemDrive'] ?? 'C:', 'Riot Games', 'League of Legends', 'lockfile');
  }
}
