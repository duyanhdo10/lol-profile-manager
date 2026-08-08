import type {
  BannerMode,
  ChallengeShowcase,
  CrestMode,
  Division,
  ProfileDraft,
  Queue,
  RankAppearance,
  RankDisplayDraft,
  RegaliaAppearance,
  Tier,
} from '../src/shared/models';

export const MAX_STATUS_LENGTH = 128;
const queues = new Set<Queue>(['RANKED_SOLO_5x5', 'RANKED_FLEX_SR', 'RANKED_TFT']);
const tiers = new Set<Tier>([
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
]);
const divisions = new Set<Division>(['I', 'II', 'III', 'IV']);
const crestModes = new Set<CrestMode>(['prestige', 'ranked']);
const bannerModes = new Set<BannerMode>(['blank', 'lastSeasonHighestRank', 'highestRank']);
const contentIdPattern = /^[a-z0-9][a-z0-9-]{0,99}$/i;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function validateRank(value: unknown): value is RankAppearance {
  if (!object(value)) return false;
  if (
    !queues.has(value['queue'] as Queue) ||
    !tiers.has(value['tier'] as Tier) ||
    !divisions.has(value['division'] as Division)
  )
    return false;
  return (
    !['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(value['tier'] as string) || value['division'] === 'I'
  );
}

export function validateRankDisplayDraft(value: unknown): value is RankDisplayDraft {
  if (!object(value) || !queues.has(value['activeQueue'] as Queue) || !object(value['queues'])) return false;
  const rankQueues = value['queues'] as Record<string, unknown>;
  return [...queues].every((queue) => {
    const appearance = rankQueues[queue];
    return validateRank(appearance) && appearance.queue === queue;
  });
}

export function validateChallengeShowcase(value: unknown): value is ChallengeShowcase {
  if (!object(value)) return false;
  const title = value['titleContentId'];
  if (title !== undefined && (typeof title !== 'string' || !contentIdPattern.test(title))) return false;
  const accent = value['bannerAccent'];
  if (accent !== undefined && (typeof accent !== 'string' || !contentIdPattern.test(accent))) return false;
  const tokens = value['tokenIds'];
  if (tokens !== undefined) {
    if (!Array.isArray(tokens) || tokens.length > 3 || !tokens.every(finiteId)) return false;
    if (new Set(tokens).size !== tokens.length) return false;
  }
  return true;
}

export function validateRegalia(value: unknown): value is RegaliaAppearance {
  if (!object(value)) return false;
  return (
    crestModes.has(value['preferredCrestType'] as CrestMode) &&
    bannerModes.has(value['preferredBannerType'] as BannerMode) &&
    finiteId(value['selectedPrestigeCrest']) &&
    Number(value['selectedPrestigeCrest']) <= 255
  );
}

export function validateDraft(value: unknown): asserts value is ProfileDraft {
  if (!object(value)) throw new Error('Profile draft must be an object.');
  const allowed = new Set([
    'iconId',
    'backgroundSkinId',
    'challengeShowcase',
    'regalia',
    'statusMessage',
    'rank',
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key)))
    throw new Error('Profile draft contains an unsupported field.');
  if (value['iconId'] !== undefined && !finiteId(value['iconId'])) throw new Error('Invalid icon ID.');
  if (value['backgroundSkinId'] !== undefined && !finiteId(value['backgroundSkinId']))
    throw new Error('Invalid background skin ID.');
  if (value['challengeShowcase'] !== undefined && !validateChallengeShowcase(value['challengeShowcase']))
    throw new Error('Invalid challenge showcase: use valid content IDs and at most three unique token IDs.');
  if (value['regalia'] !== undefined && !validateRegalia(value['regalia']))
    throw new Error('Invalid regalia crest mode, banner mode, or prestige crest.');
  if (
    value['statusMessage'] !== undefined &&
    (typeof value['statusMessage'] !== 'string' || value['statusMessage'].length > MAX_STATUS_LENGTH)
  )
    throw new Error(`Status must be at most ${MAX_STATUS_LENGTH} characters.`);
  if (value['rank'] !== undefined && !validateRankDisplayDraft(value['rank']))
    throw new Error('Invalid rank tier, division, or queue.');
}
