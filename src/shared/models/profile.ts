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
export type BannerMode = 'lastSeasonHighestRank' | 'highestRank';

export interface RankAppearance {
  queue: Queue;
  tier: Tier;
  division: Division;
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
  iconId: number | null;
  backgroundSkinId: number | null;
  challengeShowcase: ChallengeShowcase;
  regalia: RegaliaAppearance;
  statusMessage: string;
  rank: RankAppearance | null;
}

export interface ProfileDraft {
  iconId?: number;
  backgroundSkinId?: number;
  challengeShowcase?: ChallengeShowcase;
  regalia?: RegaliaAppearance;
  statusMessage?: string;
  rank?: RankAppearance;
}

export const EMPTY_PROFILE: ProfileState = {
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
};
