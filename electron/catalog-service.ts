import path from 'node:path';
import type {
  AppLocale,
  CatalogItem,
  CatalogRequest,
  CatalogSnapshot,
  ChallengeTier,
  ChallengeTitleCatalogItem,
  ChallengeTokenCatalogItem,
  CompatibilityRecord,
  InventorySnapshot,
  Ownership,
  ProfileField,
  RegaliaCatalogItem,
  RankEmblemCatalogItem,
} from '../src/shared/models';
import { JsonFileStore } from './file-store';

const DAY_MS = 24 * 60 * 60 * 1000;
export const CATALOG_SCHEMA_VERSION = 5;
const ALLOWED_HOSTS = new Set(['raw.communitydragon.org']);
const TIERS: ChallengeTier[] = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
];

interface RawIcon {
  id?: number;
  title?: string;
  description?: string;
  imagePath?: string;
  yearReleased?: number;
  rarity?: string;
  isLegacy?: boolean;
}

interface RawSkin {
  id?: number;
  name?: string;
  championId?: number;
  loadScreenPath?: string;
  splashPath?: string;
  rarity?: string;
  isLegacy?: boolean;
  skinLines?: Array<{ id?: number }>;
}

interface RawChampion {
  id?: number;
  key?: string;
  name?: string;
  alias?: string;
}

interface RawChallenge {
  name?: string;
  description?: string;
  descriptionShort?: string;
  tags?: { parent?: string; isCategory?: string; isCapstone?: string };
  levelToIconPath?: Partial<Record<ChallengeTier, string>>;
  thresholds?: Partial<Record<ChallengeTier, { rewards?: Array<{ category?: string; id?: string }> }>>;
}

interface RawChallenges {
  challenges?: Record<string, RawChallenge>;
}

interface RawTitle {
  contentId?: string;
  itemId?: number;
  titleName?: string;
  titleDescription?: string;
  titleAcquisitionType?: string;
  iconPath?: string;
  backgroundImagePath?: string;
}

interface RawRegalia {
  id?: string;
  contentId?: string;
  assetPath?: string;
  isSelectable?: boolean;
  regaliaType?: string;
  localizedName?: string;
  localizedDescription?: string;
  isTencentOnly?: boolean;
}

interface ContentMetadata {
  version?: string;
}

export interface CatalogInputs {
  patch: string;
  sourceVersion: string;
  fetchedAt: string;
  icons: RawIcon[] | Record<string, RawIcon>;
  skins: RawSkin[] | Record<string, RawSkin>;
  champions: RawChampion[] | Record<string, RawChampion> | { data?: Record<string, RawChampion> };
  challenges: RawChallenges | Record<string, RawChallenge>;
  titles: RawTitle[] | Record<string, RawTitle>;
  regalia: RawRegalia[] | Record<string, RawRegalia>;
  locale?: AppLocale;
  requestedLocale?: AppLocale;
  fallbacks?: CatalogSnapshot['fallbacks'];
}

interface CatalogCacheV5 {
  schemaVersion: 5;
  snapshots: Partial<Record<AppLocale, CatalogSnapshot>>;
}

type OwnedCatalogEntry = { ownership: Ownership };
type CompatibleCatalogEntry = { compatibility: CatalogItem['compatibility'] };

function collectionValues<T>(value: T[] | Record<string, T>, label: string): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'object' && value !== null) return Object.values(value);
  throw new Error(`CommunityDragon ${label} payload is neither an array nor an object map.`);
}

export function exactPatch(version: string): string | null {
  const match = version.match(/(?:^|\D)(\d{1,2})\.(\d{1,2})(?:\D|$)/);
  return match ? `${Number(match[1])}.${Number(match[2])}` : null;
}

export function cdragonAssetUrl(pathValue: string | undefined, patch: string, fallbackPath = ''): string {
  const source = pathValue?.trim() || fallbackPath;
  if (!source) return '';
  if (/^https:\/\/raw\.communitydragon\.org\//i.test(source)) return source;
  const normalized = source
    .replace(/^https?:\/\/[^/]+\//i, '')
    .replace(/^\/?lol-game-data\/assets\//i, '')
    .replace(/^\/?plugins\/rcp-be-lol-game-data\/global\/default\//i, '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .toLowerCase();
  return `https://raw.communitydragon.org/${patch}/plugins/rcp-be-lol-game-data/global/default/${normalized}`;
}

export function rankEmblemUrl(tier: ChallengeTier, patch: string): string {
  return `https://raw.communitydragon.org/${patch}/plugins/rcp-fe-lol-static-assets/global/default/ranked-emblem/emblem-${tier.toLowerCase()}.png`;
}

function overlayOwnedBy<T extends OwnedCatalogEntry, K extends string | number>(
  items: T[],
  ownedIds: K[] | null,
  key: (item: T) => K,
): T[] {
  const owned = ownedIds === null ? null : new Set<K>(ownedIds);
  return items.map((item) => ({
    ...item,
    ownership: owned === null ? 'unknown' : owned.has(key(item)) ? 'owned' : 'unowned',
  }));
}

export function overlayOwnership(items: CatalogItem[], ownedIds: number[] | null): CatalogItem[] {
  return overlayOwnedBy(items, ownedIds, (item) => item.id);
}

function overlayCompatibleBy<T extends CompatibleCatalogEntry>(
  items: T[],
  clientVersion: string,
  records: CompatibilityRecord[],
  field: ProfileField,
  key: (item: T) => string | number,
): T[] {
  const rejected = new Set(
    records
      .filter(
        (record) => record.clientVersion === clientVersion && record.field === field && !record.compatible,
      )
      .map((record) => String(record.itemId)),
  );
  return items.map((item) => ({
    ...item,
    compatibility: rejected.has(String(key(item))) ? 'not-compatible' : 'unknown',
  }));
}

export function overlayCompatibility(
  items: CatalogItem[],
  clientVersion: string,
  records: CompatibilityRecord[],
): CatalogItem[] {
  return items.map((item) => {
    const field: ProfileField = item.kind === 'icon' ? 'icon' : 'background';
    return overlayCompatibleBy([item], clientVersion, records, field, (entry) => entry.id)[0] as CatalogItem;
  });
}

function sourceMetadata(sourceVersion: string) {
  return {
    source: 'CommunityDragon' as const,
    sourceVersion,
    ownership: 'unknown' as const,
    compatibility: 'unknown' as const,
  };
}

function challengeMap(value: RawChallenges | Record<string, RawChallenge>): Record<string, RawChallenge> {
  if ('challenges' in value && value.challenges && typeof value.challenges === 'object')
    return value.challenges as Record<string, RawChallenge>;
  return value as Record<string, RawChallenge>;
}

function highestTier(paths: RawChallenge['levelToIconPath']): ChallengeTier | undefined {
  return [...TIERS].reverse().find((tier) => Boolean(paths?.[tier]));
}

export function normalizeCatalog(input: CatalogInputs): CatalogSnapshot {
  if (!exactPatch(input.sourceVersion) || exactPatch(input.sourceVersion) !== input.patch) {
    throw new Error(
      `CommunityDragon snapshot mismatch: requested ${input.patch}, received ${input.sourceVersion}.`,
    );
  }

  const rawChampions =
    'data' in input.champions && input.champions.data
      ? Object.values(input.champions.data)
      : collectionValues(input.champions as RawChampion[] | Record<string, RawChampion>, 'champions');
  const championNames = new Map<number, string>();
  for (const champion of rawChampions) {
    const id = champion.id ?? Number(champion.key);
    if (Number.isSafeInteger(id))
      championNames.set(id, champion.name?.trim() || champion.alias?.trim() || `Champion ${id}`);
  }

  const icons: CatalogItem[] = collectionValues(input.icons, 'icons').flatMap((icon) => {
    if (!Number.isSafeInteger(icon.id)) return [];
    const id = icon.id as number;
    return [
      {
        id,
        kind: 'icon',
        name: icon.title?.trim() || `Summoner icon ${id}`,
        description: icon.description,
        imageUrl: cdragonAssetUrl(icon.imagePath, input.patch, `v1/profile-icons/${id}.jpg`),
        ...sourceMetadata(input.sourceVersion),
        rarity: icon.rarity,
        year: icon.yearReleased,
        legacy: Boolean(icon.isLegacy),
        visibility: ['Friends/hovercard', 'Transient'],
      },
    ];
  });

  const backgrounds: CatalogItem[] = collectionValues(input.skins, 'skins').flatMap((skin) => {
    if (!Number.isSafeInteger(skin.id)) return [];
    const id = skin.id as number;
    return [
      {
        id,
        kind: 'background',
        name: skin.name?.trim() || `Skin ${id}`,
        imageUrl: cdragonAssetUrl(skin.splashPath || skin.loadScreenPath, input.patch),
        ...sourceMetadata(input.sourceVersion),
        champion: championNames.get(skin.championId ?? Math.floor(id / 1000)),
        skinline:
          skin.skinLines
            ?.map((line) => line.id)
            .filter((value): value is number => Number.isSafeInteger(value))
            .join(', ') || undefined,
        rarity: skin.rarity,
        legacy: Boolean(skin.isLegacy),
        visibility: ['Self profile'],
      },
    ];
  });

  const challenges = challengeMap(input.challenges);
  const challengeNames = new Map(
    Object.entries(challenges).map(([id, challenge]) => [id, challenge.name?.trim() || `Challenge ${id}`]),
  );
  const titleMetadata = new Map<string, { category?: string; tier?: ChallengeTier }>();
  for (const challenge of Object.values(challenges)) {
    const parent = challenge.tags?.parent;
    for (const tier of TIERS) {
      for (const reward of challenge.thresholds?.[tier]?.rewards ?? []) {
        if (reward.category === 'TITLE' && reward.id)
          titleMetadata.set(reward.id, { category: parent ? challengeNames.get(parent) : undefined, tier });
      }
    }
  }

  const tokens: ChallengeTokenCatalogItem[] = Object.entries(challenges).flatMap(([idValue, challenge]) => {
    const id = Number(idValue);
    const tier = highestTier(challenge.levelToIconPath);
    if (!Number.isSafeInteger(id) || !tier) return [];
    const parent = challenge.tags?.parent;
    return [
      {
        id,
        name: challenge.name?.trim() || `Challenge ${id}`,
        description: challenge.descriptionShort?.trim() || challenge.description?.trim() || undefined,
        imageUrl: cdragonAssetUrl(challenge.levelToIconPath?.[tier], input.patch),
        ...sourceMetadata(input.sourceVersion),
        category: parent ? challengeNames.get(parent) : undefined,
        tier,
        visibility: ['Profile/hovercard'],
      },
    ];
  });

  const titles: ChallengeTitleCatalogItem[] = collectionValues(input.titles, 'titles').flatMap((title) => {
    if (!title.contentId || !Number.isSafeInteger(title.itemId)) return [];
    const related = titleMetadata.get(title.contentId);
    return [
      {
        contentId: title.contentId,
        itemId: title.itemId as number,
        name: title.titleName?.trim() || `Title ${title.itemId}`,
        description: title.titleDescription?.trim() || undefined,
        imageUrl: cdragonAssetUrl(title.iconPath || title.backgroundImagePath, input.patch),
        ...sourceMetadata(input.sourceVersion),
        acquisitionType: title.titleAcquisitionType,
        category: related?.category,
        tier: related?.tier,
        visibility: ['Profile/hovercard'],
      },
    ];
  });

  const regalia: RegaliaCatalogItem[] = collectionValues(input.regalia, 'regalia').flatMap((item) => {
    if (
      !item.isSelectable ||
      item.isTencentOnly ||
      item.regaliaType === 'kNone' ||
      item.regaliaType !== 'kBanner' ||
      !item.contentId
    )
      return [];
    return [
      {
        id: item.id?.trim() || item.contentId,
        contentId: item.contentId,
        regaliaType: 'kBanner',
        name: item.localizedName?.trim() || `Banner ${item.id || item.contentId}`,
        description: item.localizedDescription?.trim() || undefined,
        imageUrl: cdragonAssetUrl(item.assetPath, input.patch),
        ...sourceMetadata(input.sourceVersion),
        visibility: ['Profile/hovercard'],
      },
    ];
  });
  const rankEmblems: RankEmblemCatalogItem[] = TIERS.map((tier) => ({
    tier,
    name: `${tier} ranked emblem`,
    imageUrl: rankEmblemUrl(tier, input.patch),
    ...sourceMetadata(input.sourceVersion),
    visibility: ['Profile/hovercard'],
  }));

  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    version: input.sourceVersion,
    patch: input.patch,
    fetchedAt: input.fetchedAt,
    fromCache: false,
    stale: false,
    compatible: true,
    locale: input.locale ?? 'en_US',
    requestedLocale: input.requestedLocale ?? input.locale ?? 'en_US',
    fallbacks: input.fallbacks ?? [],
    icons,
    backgrounds,
    titles,
    tokens,
    regalia,
    rankEmblems,
  };
}

async function fetchJson<T>(urlValue: string): Promise<T> {
  const url = new URL(urlValue);
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname))
    throw new Error('Catalog URL is not allowlisted.');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
  return (await response.json()) as T;
}

function validSnapshot(snapshot: unknown): snapshot is CatalogSnapshot {
  if (typeof snapshot !== 'object' || snapshot === null) return false;
  const value = snapshot as Partial<CatalogSnapshot>;
  return (
    (value.schemaVersion === 3 ||
      value.schemaVersion === 4 ||
      value.schemaVersion === CATALOG_SCHEMA_VERSION) &&
    typeof value.patch === 'string' &&
    Array.isArray(value.titles) &&
    Array.isArray(value.tokens) &&
    Array.isArray(value.regalia)
  );
}

function migrateSnapshot(snapshot: CatalogSnapshot): CatalogSnapshot {
  return {
    ...snapshot,
    schemaVersion: CATALOG_SCHEMA_VERSION,
    rankEmblems: Array.isArray(snapshot.rankEmblems) ? snapshot.rankEmblems : [],
  };
}

function migrateCache(value: unknown): CatalogCacheV5 {
  const root = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  const snapshots =
    root && typeof root['snapshots'] === 'object' && root['snapshots'] !== null
      ? (root['snapshots'] as Partial<Record<AppLocale, CatalogSnapshot>>)
      : null;
  if (snapshots && root?.['schemaVersion'] === CATALOG_SCHEMA_VERSION) return value as CatalogCacheV5;
  if (snapshots) {
    return {
      schemaVersion: CATALOG_SCHEMA_VERSION,
      snapshots: Object.fromEntries(
        Object.entries(snapshots).map(([locale, snapshot]) => [
          locale,
          snapshot && validSnapshot(snapshot) ? migrateSnapshot(snapshot) : snapshot,
        ]),
      ),
    };
  }
  if (validSnapshot(value)) {
    return {
      schemaVersion: CATALOG_SCHEMA_VERSION,
      snapshots: {
        en_US: {
          ...migrateSnapshot(value),
          locale: 'en_US',
          requestedLocale: 'en_US',
          fallbacks: [],
        },
      },
    };
  }
  return { schemaVersion: CATALOG_SCHEMA_VERSION, snapshots: {} };
}

export async function loadLocalizedFile<T>(
  locale: AppLocale,
  file: string,
  loader: (sourceLocale: AppLocale, file: string) => Promise<T>,
): Promise<{ data: T; fallback: CatalogSnapshot['fallbacks'][number] | null }> {
  try {
    return { data: await loader(locale, file), fallback: null };
  } catch (error: unknown) {
    if (locale === 'en_US') throw error;
    return {
      data: await loader('en_US', file),
      fallback: { file, requestedLocale: locale, actualLocale: 'en_US' },
    };
  }
}

export class CatalogService {
  private readonly store: JsonFileStore<CatalogCacheV5 | CatalogSnapshot | null>;

  constructor(
    userDataPath: string,
    private readonly downloader?: (patch?: string, locale?: AppLocale) => Promise<CatalogSnapshot>,
  ) {
    this.store = new JsonFileStore(path.join(userDataPath, 'catalog-snapshot.json'), null);
  }

  async get(
    request: CatalogRequest | boolean,
    inventory: InventorySnapshot,
    clientVersion: string,
    compatibility: CompatibilityRecord[],
  ): Promise<CatalogSnapshot> {
    const normalizedRequest: CatalogRequest =
      typeof request === 'boolean'
        ? { locale: 'en_US', mode: request ? 'force-refresh' : 'cache-first' }
        : request;
    const stored = await this.store.read();
    const cache = migrateCache(stored);
    if (validSnapshot(stored) && stored.schemaVersion !== CATALOG_SCHEMA_VERSION) {
      await this.store.write(cache);
    }
    const requestedLocaleCache = cache.snapshots[normalizedRequest.locale];
    const cached =
      requestedLocaleCache ?? (normalizedRequest.locale === 'vi_VN' ? cache.snapshots.en_US : undefined);
    const usableCache = validSnapshot(cached);
    const cacheLocaleFallback = usableCache && !requestedLocaleCache;
    const requestedPatch = exactPatch(clientVersion) ?? undefined;
    const fresh = usableCache && Date.now() - Date.parse(cached.fetchedAt) < DAY_MS;
    const patchMatches = usableCache && (!requestedPatch || cached.patch === requestedPatch);
    const cacheSchemaStale = usableCache && cached.rankEmblems.length === 0;
    let snapshot: CatalogSnapshot;

    if (normalizedRequest.mode === 'cache-first' && usableCache) {
      snapshot = {
        ...cached,
        fromCache: true,
        stale: cacheLocaleFallback || cacheSchemaStale || !fresh || !patchMatches,
        refreshFailed: false,
        requestedLocale: normalizedRequest.locale,
        fallbacks: cacheLocaleFallback
          ? [
              ...cached.fallbacks,
              {
                file: 'catalog-cache',
                requestedLocale: normalizedRequest.locale,
                actualLocale: cached.locale,
              },
            ]
          : cached.fallbacks,
      };
    } else {
      try {
        const downloaded = this.downloader
          ? normalizedRequest.locale === 'en_US'
            ? await this.downloader(requestedPatch)
            : await this.downloader(requestedPatch, normalizedRequest.locale)
          : await this.download(requestedPatch, normalizedRequest.locale);
        snapshot = {
          ...downloaded,
          schemaVersion: CATALOG_SCHEMA_VERSION,
          locale: downloaded.locale ?? normalizedRequest.locale,
          requestedLocale: normalizedRequest.locale,
          fallbacks: downloaded.fallbacks ?? [],
          refreshFailed: false,
        };
        cache.snapshots[normalizedRequest.locale] = snapshot;
        await this.store.write(cache);
      } catch (error: unknown) {
        if (!usableCache) throw error;
        snapshot = {
          ...cached,
          fromCache: true,
          stale: cacheLocaleFallback || cacheSchemaStale || !fresh || !patchMatches,
          refreshFailed: true,
          requestedLocale: normalizedRequest.locale,
          fallbacks: cacheLocaleFallback
            ? [
                ...cached.fallbacks,
                {
                  file: 'catalog-cache',
                  requestedLocale: normalizedRequest.locale,
                  actualLocale: cached.locale,
                },
              ]
            : cached.fallbacks,
        };
      }
    }

    const snapshotCompatible = !requestedPatch || snapshot.patch === requestedPatch;
    const icons = overlayCompatibility(
      overlayOwnership(snapshot.icons, inventory.iconIds),
      clientVersion,
      compatibility,
    );
    const backgrounds = overlayCompatibility(
      overlayOwnership(snapshot.backgrounds, inventory.skinIds),
      clientVersion,
      compatibility,
    );
    const titles = overlayCompatibleBy(
      overlayOwnedBy(snapshot.titles, inventory.titleContentIds, (item) => item.contentId),
      clientVersion,
      compatibility,
      'challengeShowcase',
      (item) => item.contentId,
    );
    const tokens = overlayCompatibleBy(
      overlayOwnedBy(snapshot.tokens, inventory.challengeIds, (item) => item.id),
      clientVersion,
      compatibility,
      'challengeShowcase',
      (item) => item.id,
    );
    const regalia = overlayCompatibleBy(
      overlayOwnedBy(snapshot.regalia, inventory.regaliaContentIds, (item) => item.contentId),
      clientVersion,
      compatibility,
      'challengeShowcase',
      (item) => item.contentId,
    );

    return { ...snapshot, compatible: snapshotCompatible, icons, backgrounds, titles, tokens, regalia };
  }

  private async download(requestedPatch?: string, locale: AppLocale = 'en_US'): Promise<CatalogSnapshot> {
    let patch = requestedPatch;
    if (!patch) {
      const latest = await fetchJson<ContentMetadata>(
        'https://raw.communitydragon.org/latest/content-metadata.json',
      );
      patch = exactPatch(latest.version ?? '') ?? undefined;
      if (!patch) throw new Error('CommunityDragon latest metadata returned no valid patch.');
    }

    const root = `https://raw.communitydragon.org/${patch}`;
    const defaultBase = `${root}/plugins/rcp-be-lol-game-data/global/default/v1`;
    const localizedBase =
      locale === 'vi_VN' ? `${root}/plugins/rcp-be-lol-game-data/global/vi_vn/v1` : defaultBase;
    const fallbacks: CatalogSnapshot['fallbacks'] = [];
    const localized = async <T>(file: string): Promise<T> => {
      const result = await loadLocalizedFile(locale, file, (sourceLocale, sourceFile) =>
        fetchJson<T>(`${sourceLocale === 'vi_VN' ? localizedBase : defaultBase}/${sourceFile}`),
      );
      if (result.fallback) fallbacks.push(result.fallback);
      return result.data;
    };
    const [metadata, icons, skins, champions, challenges, titles, regalia] = await Promise.all([
      fetchJson<ContentMetadata>(`${root}/content-metadata.json`),
      localized<RawIcon[] | Record<string, RawIcon>>('summoner-icons.json'),
      localized<RawSkin[] | Record<string, RawSkin>>('skins.json'),
      localized<RawChampion[] | Record<string, RawChampion>>('champion-summary.json'),
      localized<RawChallenges | Record<string, RawChallenge>>('challenges.json'),
      localized<RawTitle[] | Record<string, RawTitle>>('achievementtitles.json'),
      localized<RawRegalia[] | Record<string, RawRegalia>>('regalia.json'),
    ]);
    if (!metadata.version) throw new Error('CommunityDragon snapshot metadata returned no version.');
    return normalizeCatalog({
      patch,
      sourceVersion: metadata.version,
      fetchedAt: new Date().toISOString(),
      icons,
      skins,
      champions,
      challenges,
      titles,
      regalia,
      locale,
      requestedLocale: locale,
      fallbacks,
    });
  }
}
