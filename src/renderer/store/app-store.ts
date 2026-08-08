import { notifications } from '@mantine/notifications';
import { create } from 'zustand';
import type {
  AppLocale,
  ApplyPreview,
  ApplyProfileResult,
  CatalogLoadMode,
  CatalogSnapshot,
  ConnectionState,
  IpcErrorPayload,
  LocaleMode,
  ProfileDraft,
  ProfileField,
  ProfileState,
} from '../../shared/models';
import { EMPTY_PROFILE } from '../../shared/models';
import { i18n, readLocaleMode, resolveLocale, writeLocaleMode } from '../features/settings/i18n';

export interface AppState {
  initialized: boolean;
  connection: ConnectionState;
  current: ProfileState;
  catalog: CatalogSnapshot | null;
  draft: ProfileDraft;
  preview: ApplyPreview | null;
  applyResult: ApplyProfileResult | null;
  busy: boolean;
  catalogBusy: boolean;
  error: IpcErrorPayload | null;
  resetBanner: boolean;
  localeMode: LocaleMode;
  locale: AppLocale;
  initialize(): Promise<void>;
  handleConnection(connection: ConnectionState): Promise<void>;
  setConnection(connection: ConnectionState): void;
  reloadConnectedData(): Promise<void>;
  refreshCatalog(force?: boolean): Promise<void>;
  setLocaleMode(mode: LocaleMode): Promise<void>;
  syncAutoLocale(): Promise<void>;
  patchDraft(patch: Partial<ProfileDraft>): void;
  replaceDraft(draft: ProfileDraft): void;
  clearField(field: ProfileField): void;
  clearDraft(): void;
  prepareApply(): Promise<void>;
  confirmApply(): Promise<void>;
  closePreview(): void;
  dismissError(): void;
  setResetBanner(value: boolean): void;
}

function appError(error: unknown, fallbackCode = 'REQUEST_FAILED'): IpcErrorPayload {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return error as IpcErrorPayload;
  }
  return {
    code: fallbackCode,
    technicalMessage: error instanceof Error ? error.message : String(error),
  };
}

const initialMode = typeof localStorage === 'undefined' ? 'auto' : readLocaleMode();
const browserLanguage = typeof navigator === 'undefined' ? 'en_US' : navigator.language;
const initialLocale = resolveLocale(initialMode, null, browserLanguage);

let initializePromise: Promise<void> | null = null;
let connectedDataPromise: Promise<void> | null = null;
let connectedDataLoaded = false;
const catalogRequests = new Map<string, Promise<void>>();

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  connection: 'connecting',
  current: structuredClone(EMPTY_PROFILE),
  catalog: null,
  draft: {},
  preview: null,
  applyResult: null,
  busy: false,
  catalogBusy: false,
  error: null,
  resetBanner: false,
  localeMode: initialMode,
  locale: initialLocale,

  async initialize() {
    if (initializePromise) return initializePromise;
    initializePromise = (async () => {
      if (!window.lpm) {
        set({
          initialized: true,
          connection: 'incompatible',
          error: { code: 'BRIDGE_UNAVAILABLE' },
        });
        return;
      }
      try {
        const connection = await window.lpm.getConnectionState();
        get().setConnection(connection);
        await get().syncAutoLocale();
        await Promise.all([
          get().refreshCatalog(false),
          connection === 'connected' ? get().reloadConnectedData() : Promise.resolve(),
        ]);
      } catch (error: unknown) {
        set({ error: appError(error) });
      } finally {
        set({ initialized: true });
      }
    })();
    return initializePromise;
  },

  async handleConnection(connection) {
    const previous = get().connection;
    get().setConnection(connection);
    if (connection !== 'connected') return;
    await get().initialize();
    await get().syncAutoLocale();
    if ((previous !== 'connected' || !connectedDataLoaded) && !connectedDataLoaded) {
      await get().reloadConnectedData();
      await get().refreshCatalog(false);
    }
  },

  setConnection(connection) {
    if (connection !== 'connected') connectedDataLoaded = false;
    set({ connection });
  },

  async reloadConnectedData() {
    if (connectedDataLoaded || connectedDataPromise || get().connection !== 'connected') {
      return connectedDataPromise ?? Promise.resolve();
    }
    connectedDataPromise = (async () => {
      try {
        const current = await window.lpm.readProfile();
        connectedDataLoaded = true;
        set({ current });
      } catch (error: unknown) {
        set({ error: appError(error) });
      } finally {
        connectedDataPromise = null;
      }
    })();
    return connectedDataPromise;
  },

  async refreshCatalog(force = true) {
    const locale = get().locale;
    const mode: CatalogLoadMode = force ? 'force-refresh' : 'cache-first';
    const key = `${locale}:${mode}`;
    const pending = catalogRequests.get(key);
    if (pending) return pending;
    const request = (async () => {
      const showLoader = force || !get().catalog;
      if (showLoader) set({ catalogBusy: true });
      try {
        const catalog = await window.lpm.getCatalog({ locale, mode });
        if (get().locale !== locale) return;
        set({ catalog });
        if (!force && (catalog.stale || !catalog.compatible)) {
          void get().refreshCatalog(true);
        }
      } catch (error: unknown) {
        set({ error: appError(error, 'CATALOG_UNAVAILABLE') });
      } finally {
        if (showLoader) set({ catalogBusy: false });
        catalogRequests.delete(key);
      }
    })();
    catalogRequests.set(key, request);
    return request;
  },

  async setLocaleMode(localeMode) {
    writeLocaleMode(localeMode);
    let clientLocale = null;
    if (localeMode === 'auto' && window.lpm) {
      try {
        clientLocale = await window.lpm.getClientLocale();
      } catch {
        clientLocale = null;
      }
    }
    const locale = resolveLocale(localeMode, clientLocale, browserLanguage);
    set({ localeMode, locale });
    await i18n.changeLanguage(locale);
    await get().refreshCatalog(false);
  },

  async syncAutoLocale() {
    const { localeMode } = get();
    if (localeMode !== 'auto') {
      await i18n.changeLanguage(get().locale);
      return;
    }
    let clientLocale = null;
    if (window.lpm && get().connection === 'connected') {
      try {
        clientLocale = await window.lpm.getClientLocale();
      } catch {
        clientLocale = null;
      }
    }
    const locale = resolveLocale('auto', clientLocale, browserLanguage);
    if (locale !== get().locale) set({ locale });
    await i18n.changeLanguage(locale);
  },

  patchDraft(patch) {
    set((state) => ({
      draft: { ...state.draft, ...patch },
      preview: null,
      applyResult: null,
    }));
  },
  replaceDraft(draft) {
    set({ draft, preview: null, applyResult: null });
  },
  clearField(field) {
    set((state) => {
      const draft = { ...state.draft };
      if (field === 'icon') delete draft.iconId;
      if (field === 'background') delete draft.backgroundSkinId;
      if (field === 'challengeShowcase') delete draft.challengeShowcase;
      if (field === 'regalia') delete draft.regalia;
      if (field === 'status') delete draft.statusMessage;
      if (field === 'rank') delete draft.rank;
      return { draft, preview: null, applyResult: null };
    });
  },
  clearDraft() {
    set({ draft: {}, preview: null, applyResult: null });
  },

  async prepareApply() {
    const { connection, draft, catalog } = get();
    if (connection !== 'connected' || Object.keys(draft).length === 0 || catalog?.compatible === false)
      return;
    set({ busy: true, error: null });
    try {
      set({ preview: await window.lpm.previewApply(draft), applyResult: null });
    } catch (error: unknown) {
      set({ error: appError(error) });
    } finally {
      set({ busy: false });
    }
  },

  async confirmApply() {
    const draft = get().draft;
    set({ busy: true, error: null });
    try {
      const applyResult = await window.lpm.applyDraft(draft);
      set({
        applyResult,
        preview: null,
        current: applyResult.finalState,
        resetBanner: false,
        draft: applyResult.succeeded ? {} : draft,
      });
      notifications.show({
        color: applyResult.succeeded ? 'teal' : 'red',
        title: i18n.t(applyResult.succeeded ? 'notification.updated' : 'notification.stopped'),
        message: i18n.t(applyResult.succeeded ? 'notification.applied' : 'notification.rollback'),
      });
      await get().refreshCatalog(false);
    } catch (error: unknown) {
      set({ error: appError(error) });
    } finally {
      set({ busy: false });
    }
  },

  closePreview() {
    set({ preview: null });
  },
  dismissError() {
    set({ error: null });
  },
  setResetBanner(resetBanner) {
    set({ resetBanner });
  },
}));

export function resetAppStoreCoordinatorsForTests(): void {
  initializePromise = null;
  connectedDataPromise = null;
  connectedDataLoaded = false;
  catalogRequests.clear();
}
