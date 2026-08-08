import type {
  ApplyPreview,
  ApplyProfileResult,
  ApplyStepResult,
  CatalogSnapshot,
  ChallengeShowcase,
  InventorySnapshot,
  ProfileField,
  ProfileDraft,
  ProfileState,
  RankAppearance,
  RegaliaAppearance,
} from '../src/shared/models';
import { LcuError } from './lcu-client';
import type { LcuClient } from './lcu-client';
import { validateDraft } from './validation';

type FieldValue = number | string | RankAppearance | ChallengeShowcase | RegaliaAppearance | null;

export const APPLY_ORDER: ProfileField[] = [
  'background',
  'icon',
  'challengeShowcase',
  'regalia',
  'status',
  'rank',
];

function hasField(draft: ProfileDraft, field: ProfileField): boolean {
  if (field === 'background') return draft.backgroundSkinId !== undefined;
  if (field === 'icon') return draft.iconId !== undefined;
  if (field === 'challengeShowcase') return draft.challengeShowcase !== undefined;
  if (field === 'regalia') return draft.regalia !== undefined;
  if (field === 'status') return draft.statusMessage !== undefined;
  return draft.rank !== undefined;
}

function draftValue(draft: ProfileDraft, before: ProfileState, field: ProfileField): FieldValue {
  if (field === 'background') return draft.backgroundSkinId ?? null;
  if (field === 'icon') return draft.iconId ?? null;
  if (field === 'challengeShowcase') return { ...before.challengeShowcase, ...draft.challengeShowcase };
  if (field === 'regalia') return draft.regalia ?? before.regalia;
  if (field === 'status') return draft.statusMessage ?? '';
  return draft.rank ?? null;
}

function stateValue(state: ProfileState, field: ProfileField): FieldValue {
  if (field === 'background') return state.backgroundSkinId;
  if (field === 'icon') return state.iconId;
  if (field === 'challengeShowcase') return state.challengeShowcase;
  if (field === 'regalia') return state.regalia;
  if (field === 'status') return state.statusMessage;
  return state.rank;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function compatibilityKeys(field: ProfileField, value: FieldValue): Array<string | number> {
  if (typeof value === 'number') return [value];
  if (field === 'challengeShowcase' && value && typeof value === 'object') {
    const showcase = value as ChallengeShowcase;
    return [showcase.titleContentId, ...(showcase.tokenIds ?? []), showcase.bannerAccent].filter(
      (entry): entry is string | number => typeof entry === 'string' || typeof entry === 'number',
    );
  }
  if (field === 'regalia' && value && typeof value === 'object')
    return [(value as RegaliaAppearance).selectedPrestigeCrest];
  return [];
}

export class ApplyService {
  constructor(
    private readonly lcu: Pick<
      LcuClient,
      'getState' | 'getClientVersion' | 'readProfile' | 'readInventory' | 'request'
    >,
    private readonly compatibility: {
      record(
        clientVersion: string,
        field: ProfileField,
        itemId: string | number,
        compatible: boolean,
      ): Promise<void>;
    },
    private readonly getCatalog: () => Promise<CatalogSnapshot>,
  ) {}

  async preview(draft: ProfileDraft): Promise<ApplyPreview> {
    validateDraft(draft);
    const [before, catalog] = await Promise.all([this.lcu.readProfile(), this.getCatalog()]);
    const warnings: ApplyPreview['warnings'] = [];
    if (!catalog.compatible) {
      warnings.push({
        field: 'challengeShowcase',
        level: 'warning',
        code: 'PATCH_MISMATCH',
        params: { patch: catalog.patch },
        message: `Cached CommunityDragon patch ${catalog.patch} does not match this League Client. Apply is disabled until the matching snapshot is available.`,
      });
    }
    const targets = [
      {
        field: 'background' as const,
        id: draft.backgroundSkinId,
        list: catalog.backgrounds,
        key: (entry: CatalogSnapshot['backgrounds'][number]) => entry.id,
      },
      {
        field: 'icon' as const,
        id: draft.iconId,
        list: catalog.icons,
        key: (entry: CatalogSnapshot['icons'][number]) => entry.id,
      },
    ];
    for (const target of targets) {
      if (target.id === undefined) continue;
      const item = target.list.find((entry) => target.key(entry) === target.id);
      const ownership = item?.ownership ?? 'unknown';
      if (ownership !== 'owned')
        warnings.push({
          field: target.field,
          level: 'warning',
          code: 'OWNERSHIP',
          params: { field: target.field, id: target.id, ownership },
          message: `${target.field} ${target.id} is ${ownership}; Apply remains available but does not grant ownership.`,
        });
      if (item?.compatibility === 'not-compatible')
        warnings.push({
          field: target.field,
          level: 'warning',
          code: 'REJECTED',
          params: { field: target.field, id: target.id },
          message: `${target.field} ${target.id} was rejected by this League Client version.`,
        });
      if (item?.visibility.includes('Transient'))
        warnings.push({
          field: target.field,
          level: 'info',
          code: 'TRANSIENT',
          params: { field: target.field, id: target.id },
          message: `${target.field} ${target.id} uses a transient social presence adapter.`,
        });
    }

    if (draft.challengeShowcase) {
      const entries = [
        ...(draft.challengeShowcase.titleContentId
          ? [catalog.titles.find((item) => item.contentId === draft.challengeShowcase?.titleContentId)]
          : []),
        ...(draft.challengeShowcase.tokenIds ?? []).map((id) =>
          catalog.tokens.find((item) => item.id === id),
        ),
        ...(draft.challengeShowcase.bannerAccent
          ? [
              catalog.regalia.find(
                (item) =>
                  item.id === draft.challengeShowcase?.bannerAccent ||
                  item.contentId === draft.challengeShowcase?.bannerAccent,
              ),
            ]
          : []),
      ];
      for (const item of entries) {
        const label = item?.name ?? 'Selected showcase item';
        const ownership = item?.ownership ?? 'unknown';
        if (ownership !== 'owned')
          warnings.push({
            field: 'challengeShowcase',
            level: 'warning',
            code: 'SHOWCASE_OWNERSHIP',
            params: { label, ownership },
            message: `${label} is ${ownership}. It remains selectable, but Apply does not grant ownership.`,
          });
        if (item?.compatibility === 'not-compatible')
          warnings.push({
            field: 'challengeShowcase',
            level: 'warning',
            code: 'SHOWCASE_REJECTED',
            params: { label },
            message: `${label} was rejected by this League Client version.`,
          });
      }
    }
    if (draft.regalia !== undefined)
      warnings.push({
        field: 'regalia',
        level: 'info',
        code: 'REGALIA',
        message: 'Regalia controls profile and hovercard presentation only; no ownership claim is made.',
      });
    if (draft.statusMessage !== undefined)
      warnings.push({
        field: 'status',
        level: 'info',
        code: 'STATUS',
        message: 'Status is shown through chat presence and may be reset by the client.',
      });
    if (draft.rank !== undefined)
      warnings.push({
        field: 'rank',
        level: 'info',
        code: 'RANK',
        message: 'Hovercard rank is transient chat presence; it does not change ranked progression.',
      });
    return { before, draft, warnings };
  }

  async apply(draft: ProfileDraft): Promise<ApplyProfileResult> {
    validateDraft(draft);
    if (this.lcu.getState() !== 'connected') throw new Error('League Client is not connected.');
    const catalog = await this.getCatalog();
    if (!catalog.compatible)
      throw new Error(
        `CommunityDragon patch ${catalog.patch} does not match the connected League Client. Refresh the catalog before Apply.`,
      );
    const before = await this.lcu.readProfile();
    const inventory = await this.lcu.readInventory();
    const steps: ApplyStepResult[] = APPLY_ORDER.filter((field) => hasField(draft, field)).map((field) => ({
      field,
      attempted: false,
      succeeded: false,
      rollbackAttempted: false,
      rollbackSucceeded: null,
    }));
    const completed: ApplyStepResult[] = [];
    let failed = false;

    for (const step of steps) {
      step.attempted = true;
      const value = draftValue(draft, before, step.field);
      try {
        await this.applyField(step.field, value, inventory);
        step.succeeded = true;
        completed.push(step);
        for (const item of compatibilityKeys(step.field, value)) {
          await this.compatibility.record(this.lcu.getClientVersion(), step.field, item, true);
        }
      } catch (error: unknown) {
        failed = true;
        step.error = message(error);
        if (error instanceof LcuError && error.status >= 400 && error.status < 500) {
          for (const item of compatibilityKeys(step.field, value)) {
            await this.compatibility.record(this.lcu.getClientVersion(), step.field, item, false);
          }
        }
        break;
      }
    }

    let rollbackSucceeded = true;
    if (failed) {
      for (const step of [...completed].reverse()) {
        step.rollbackAttempted = true;
        try {
          await this.applyField(step.field, stateValue(before, step.field), inventory);
          step.rollbackSucceeded = true;
        } catch (error: unknown) {
          step.rollbackSucceeded = false;
          step.error = `${step.error ? `${step.error} ` : ''}Rollback failed: ${message(error)}`;
          rollbackSucceeded = false;
        }
      }
    }

    let finalState: ProfileState;
    try {
      finalState = await this.lcu.readProfile();
    } catch {
      finalState = this.deriveFinalState(before, draft, steps);
    }
    return {
      succeeded: !failed,
      before,
      steps,
      rollbackAttempted: failed && completed.length > 0,
      rollbackSucceeded: !failed || rollbackSucceeded,
      finalState,
    };
  }

  private async applyField(
    field: ProfileField,
    value: FieldValue,
    inventory: InventorySnapshot,
  ): Promise<void> {
    if (field === 'background') {
      if (typeof value !== 'number') throw new Error('Cannot restore an empty background.');
      await this.lcu.request('POST', '/lol-summoner/v1/current-summoner/summoner-profile', {
        key: 'backgroundSkinId',
        value,
      });
      return;
    }
    if (field === 'icon') {
      if (typeof value !== 'number') throw new Error('Cannot restore an empty icon.');
      if (inventory.iconIds?.includes(value))
        await this.lcu.request('PUT', '/lol-summoner/v1/current-summoner/icon', { profileIconId: value });
      else await this.lcu.request('PUT', '/lol-chat/v1/me', { icon: value });
      return;
    }
    if (field === 'challengeShowcase') {
      if (!value || typeof value !== 'object') throw new Error('Cannot restore an empty challenge showcase.');
      const showcase = value as ChallengeShowcase;
      await this.lcu.request('POST', '/lol-challenges/v1/update-player-preferences', {
        title: showcase.titleContentId ?? '',
        challengeIds: showcase.tokenIds ?? [],
        bannerAccent: showcase.bannerAccent ?? '',
      });
      return;
    }
    if (field === 'regalia') {
      if (!value || typeof value !== 'object') throw new Error('Cannot restore empty regalia preferences.');
      const regalia = value as RegaliaAppearance;
      await this.lcu.request('PUT', '/lol-regalia/v2/current-summoner/regalia', {
        preferredCrestType: regalia.preferredCrestType,
        preferredBannerType: regalia.preferredBannerType,
        selectedPrestigeCrest: regalia.selectedPrestigeCrest,
      });
      return;
    }
    if (field === 'status') {
      await this.lcu.request('PUT', '/lol-chat/v1/me', { statusMessage: String(value ?? '') });
      return;
    }
    if (!value || typeof value !== 'object') throw new Error('Cannot restore an empty rank.');
    const rank = value as RankAppearance;
    await this.lcu.request('PUT', '/lol-chat/v1/me', {
      lol: {
        rankedLeagueQueue: rank.queue,
        rankedLeagueTier: rank.tier,
        rankedLeagueDivision: rank.division,
      },
    });
  }

  private deriveFinalState(
    before: ProfileState,
    draft: ProfileDraft,
    steps: ApplyStepResult[],
  ): ProfileState {
    const state = structuredClone(before);
    for (const step of steps) {
      if (!step.succeeded || step.rollbackSucceeded === true) continue;
      if (step.field === 'background')
        state.backgroundSkinId = draft.backgroundSkinId ?? state.backgroundSkinId;
      if (step.field === 'icon') state.iconId = draft.iconId ?? state.iconId;
      if (step.field === 'challengeShowcase')
        state.challengeShowcase = { ...state.challengeShowcase, ...draft.challengeShowcase };
      if (step.field === 'regalia') state.regalia = draft.regalia ?? state.regalia;
      if (step.field === 'status') state.statusMessage = draft.statusMessage ?? state.statusMessage;
      if (step.field === 'rank') state.rank = draft.rank ?? state.rank;
    }
    return state;
  }
}
