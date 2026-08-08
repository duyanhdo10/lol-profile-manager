export type ProfileField = 'background' | 'icon' | 'challengeShowcase' | 'regalia' | 'status' | 'rank';
export type Queue = 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR' | 'RANKED_TFT';
export type Tier =
  | 'IRON'
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'EMERALD'
  | 'DIAMOND'
  | 'MASTER'
  | 'GRANDMASTER'
  | 'CHALLENGER';
export type Division = 'I' | 'II' | 'III' | 'IV';
export type CrestMode = 'prestige' | 'ranked';
export type BannerMode = 'blank' | 'lastSeasonHighestRank' | 'highestRank';

export interface RankAppearance {
  queue: Queue;
  tier: Tier;
  division: Division;
}

export interface RankedQueueSnapshot extends RankAppearance {
  leaguePoints?: number;
  wins?: number;
  losses?: number;
}

export type RankedQueueSnapshotMap = Record<Queue, RankedQueueSnapshot | null>;
export type RankAppearanceMap = Record<Queue, RankAppearance>;

export interface RankDisplayDraft {
  activeQueue: Queue;
  queues: RankAppearanceMap;
}

export interface ProfileIdentity {
  gameName: string;
  tagLine: string;
  accountLevel: number;
}

export interface RegaliaContext {
  resolvedCrest: CrestMode;
  resolvedBanner: BannerMode;
  accountLevel: number;
  highestRank: Tier | null;
  lastSeasonHighestRank: Tier | null;
}

export interface ChallengeShowcase {
  titleContentId?: string;
  tokenIds?: number[];
  bannerAccent?: string;
}

export interface RegaliaAppearance {
  preferredCrestType: CrestMode;
  preferredBannerType: BannerMode;
  selectedPrestigeCrest: number;
}

export interface ProfileState {
  identity: ProfileIdentity;
  iconId: number | null;
  backgroundSkinId: number | null;
  challengeShowcase: ChallengeShowcase;
  regalia: RegaliaAppearance;
  statusMessage: string;
  rank: RankAppearance | null;
  rankedQueues: RankedQueueSnapshotMap;
  regaliaContext: RegaliaContext;
}

export interface ProfileDraft {
  iconId?: number;
  backgroundSkinId?: number;
  challengeShowcase?: ChallengeShowcase;
  regalia?: RegaliaAppearance;
  statusMessage?: string;
  rank?: RankDisplayDraft;
}

export const DEFAULT_RANK_QUEUES: RankAppearanceMap = {
  RANKED_SOLO_5x5: { queue: 'RANKED_SOLO_5x5', tier: 'IRON', division: 'IV' },
  RANKED_FLEX_SR: { queue: 'RANKED_FLEX_SR', tier: 'IRON', division: 'IV' },
  RANKED_TFT: { queue: 'RANKED_TFT', tier: 'IRON', division: 'IV' },
};

export const EMPTY_PROFILE: ProfileState = {
  identity: { gameName: '', tagLine: '', accountLevel: 0 },
  iconId: null,
  backgroundSkinId: null,
  challengeShowcase: {},
  regalia: {
    preferredCrestType: 'prestige',
    preferredBannerType: 'lastSeasonHighestRank',
    selectedPrestigeCrest: 0,
  },
  statusMessage: '',
  rank: null,
  rankedQueues: {
    RANKED_SOLO_5x5: null,
    RANKED_FLEX_SR: null,
    RANKED_TFT: null,
  },
  regaliaContext: {
    resolvedCrest: 'prestige',
    resolvedBanner: 'lastSeasonHighestRank',
    accountLevel: 0,
    highestRank: null,
    lastSeasonHighestRank: null,
  },
};
