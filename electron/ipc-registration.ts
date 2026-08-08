import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type {
  AppLocale,
  CatalogRequest,
  CatalogSnapshot,
  InventorySnapshot,
  IpcErrorPayload,
} from '../src/shared/models';
import { ApplyService } from './apply-service';
import type { AppLogger } from './app-logger';
import type { CatalogService } from './catalog-service';
import type { CompatibilityStore } from './compatibility-store';
import type { LcuClient } from './lcu-client';
import { UpdateServiceError, type UpdateService } from './update-service';
import { validateDraft } from './validation';

const ERROR_MARKER = 'LPM_IPC_ERROR:';

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

interface IpcRegistrationOptions {
  trustedSender(event: IpcMainInvokeEvent): void;
  getLogger(): AppLogger | null;
  lcu: LcuClient;
  catalog: CatalogService;
  compatibility: CompatibilityStore;
  updates: UpdateService;
  proxyCatalogImages(snapshot: CatalogSnapshot): CatalogSnapshot;
}

function errorCode(channel: string, error: unknown): string {
  if (error instanceof UpdateServiceError) return error.code;
  if (error instanceof Error && /not connected/i.test(error.message)) return 'LCU_DISCONNECTED';
  return channel === 'catalog:get' ? 'CATALOG_UNAVAILABLE' : 'REQUEST_FAILED';
}

function validCatalogRequest(value: unknown): value is CatalogRequest {
  if (typeof value !== 'object' || value === null) return false;
  const request = value as Partial<CatalogRequest>;
  return (
    (request.locale === 'en_US' || request.locale === 'vi_VN') &&
    (request.mode === 'cache-first' || request.mode === 'force-refresh')
  );
}

export function registerApplicationIpc(options: IpcRegistrationOptions): void {
  const register = (channel: string, handler: Handler): void => {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      try {
        options.trustedSender(event);
        return await handler(event, ...args);
      } catch (error: unknown) {
        void options.getLogger()?.error('ipc.failed', error, { channel });
        const payload: IpcErrorPayload = {
          code: errorCode(channel, error),
          technicalMessage: error instanceof Error ? error.message : String(error),
        };
        throw new Error(`${ERROR_MARKER}${JSON.stringify(payload)}`);
      }
    });
  };

  let activeLocale: AppLocale = 'en_US';
  const getCatalog = async (request: CatalogRequest): Promise<CatalogSnapshot> => {
    activeLocale = request.locale;
    let inventory: InventorySnapshot = {
      iconIds: null,
      skinIds: null,
      titleContentIds: null,
      challengeIds: null,
      regaliaContentIds: null,
    };
    if (options.lcu.getState() === 'connected') {
      try {
        inventory = await options.lcu.readInventory();
      } catch (error: unknown) {
        void options.getLogger()?.warn('inventory.unavailable', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const snapshot = await options.catalog.get(
      request,
      inventory,
      options.lcu.getClientVersion(),
      await options.compatibility.read(),
    );
    void options.getLogger()?.info('catalog.ready', {
      mode: request.mode,
      locale: request.locale,
      version: snapshot.version,
      fromCache: snapshot.fromCache,
      stale: snapshot.stale,
      icons: snapshot.icons.length,
      backgrounds: snapshot.backgrounds.length,
      titles: snapshot.titles.length,
      tokens: snapshot.tokens.length,
      regalia: snapshot.regalia.length,
      compatible: snapshot.compatible,
    });
    return options.proxyCatalogImages(snapshot);
  };

  const apply = new ApplyService(options.lcu, options.compatibility, () =>
    getCatalog({ locale: activeLocale, mode: 'cache-first' }),
  );

  register('connection:get', () => options.lcu.getState());
  register('locale:get-client', () => options.lcu.getClientLocale());
  register('update:get-state', () => options.updates.getState());
  register('update:check', () => options.updates.checkForUpdates());
  register('update:install', () => options.updates.installUpdate());
  register('profile:read', () => options.lcu.readProfile());
  register('inventory:read', () => options.lcu.readInventory());
  register('catalog:get', (_event, request) => {
    if (!validCatalogRequest(request)) throw new Error('Invalid catalog request.');
    return getCatalog(request);
  });
  register('profile:preview-apply', (_event, value) => {
    validateDraft(value);
    return apply.preview(value);
  });
  register('profile:apply', async (_event, value) => {
    validateDraft(value);
    const result = await apply.apply(value);
    void options.getLogger()?.info('profile.apply', {
      succeeded: result.succeeded,
      rollbackAttempted: result.rollbackAttempted,
      rollbackSucceeded: result.rollbackSucceeded,
      fields: result.steps
        .filter((step) => step.attempted)
        .map((step) => `${step.field}:${step.succeeded ? 'ok' : 'failed'}`),
    });
    return result;
  });
}
