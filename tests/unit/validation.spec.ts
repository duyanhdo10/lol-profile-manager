import { describe, expect, it } from 'vitest';
import {
  validateChallengeShowcase,
  validateDraft,
  validateRank,
  validateRegalia,
} from '../../electron/validation';

describe('validation', () => {
  it('supports Emerald and all declared queues', () => {
    expect(validateRank({ queue: 'RANKED_FLEX_SR', tier: 'EMERALD', division: 'III' })).toBe(true);
    expect(validateRank({ queue: 'RANKED_TFT', tier: 'CHALLENGER', division: 'II' })).toBe(false);
  });

  it('validates strict draft fields and status size', () => {
    expect(() => validateDraft({})).not.toThrow();
    expect(() => validateDraft({ statusMessage: 'x'.repeat(129) })).toThrow(/128/);
    expect(() => validateDraft({ unsupported: true })).toThrow(/unsupported/);
  });

  it('limits showcase tokens to three unique safe IDs and validates regalia enums', () => {
    expect(
      validateChallengeShowcase({ titleContentId: 'title-one', tokenIds: [1, 2, 3], bannerAccent: '3' }),
    ).toBe(true);
    expect(validateChallengeShowcase({ tokenIds: [1, 1] })).toBe(false);
    expect(validateChallengeShowcase({ tokenIds: [1, 2, 3, 4] })).toBe(false);
    expect(validateChallengeShowcase({ titleContentId: '../unsafe' })).toBe(false);
    expect(
      validateRegalia({
        preferredCrestType: 'ranked',
        preferredBannerType: 'highestRank',
        selectedPrestigeCrest: 255,
      }),
    ).toBe(true);
    expect(
      validateRegalia({
        preferredCrestType: 'fake',
        preferredBannerType: 'highestRank',
        selectedPrestigeCrest: 1,
      }),
    ).toBe(false);
    expect(
      validateRegalia({
        preferredCrestType: 'ranked',
        preferredBannerType: 'highestRank',
        selectedPrestigeCrest: 256,
      }),
    ).toBe(false);
  });
});
