import { EventEmitter } from 'node:events';
import type { AppUpdater } from 'electron-updater';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateService } from '../../electron/update-service';
import type { UpdateServiceError } from '../../electron/update-service';

class FakeUpdater extends EventEmitter {
  autoDownload = false;
  autoInstallOnAppQuit = true;
  checkForUpdates = vi.fn(async () => null);
  quitAndInstall = vi.fn();
}

function createService(enabled = true) {
  const updater = new FakeUpdater();
  const logger = {
    info: vi.fn(async () => undefined),
    error: vi.fn(async () => undefined),
  };
  const service = new UpdateService(updater as unknown as AppUpdater, {
    enabled,
    logger,
    now: () => new Date('2026-08-08T12:00:00.000Z'),
  });
  service.start();
  return { service, updater, logger };
}

describe('UpdateService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stays disabled and never contacts GitHub when updates are disabled', async () => {
    const { service, updater } = createService(false);
    expect(await service.checkForUpdates()).toEqual({ status: 'disabled' });
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('configures background download without installing on normal app quit', () => {
    const { updater } = createService();
    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(false);
  });

  it('publishes download progress and the downloaded version', () => {
    const { service, updater } = createService();
    const states: string[] = [];
    service.onState((state) => states.push(state.status));

    updater.emit('update-available', { version: '0.1.0-beta.4' });
    updater.emit('download-progress', { percent: 42.5, transferred: 425, total: 1000 });
    updater.emit('update-downloaded', { version: '0.1.0-beta.4' });

    expect(states).toEqual(['downloading', 'downloading', 'downloaded']);
    expect(service.getState()).toEqual({
      status: 'downloaded',
      availableVersion: '0.1.0-beta.4',
      percent: 100,
      transferred: 1000,
      total: 1000,
      checkedAt: '2026-08-08T12:00:00.000Z',
    });
  });

  it('maps updater failures to a stable code and keeps technical details in main-process logs', () => {
    const { service, updater, logger } = createService();
    updater.emit('update-available', { version: '0.1.0-beta.4' });
    updater.emit('error', new Error('private network detail'));

    expect(service.getState()).toMatchObject({
      status: 'error',
      errorCode: 'UPDATE_DOWNLOAD_FAILED',
    });
    expect(logger.error).toHaveBeenCalledWith(
      'update.failed',
      expect.objectContaining({ message: 'private network detail' }),
      expect.objectContaining({ code: 'UPDATE_DOWNLOAD_FAILED' }),
    );
  });

  it('installs only after a download is ready', () => {
    const { service, updater } = createService();
    expect(() => service.installUpdate()).toThrow(
      expect.objectContaining<Partial<UpdateServiceError>>({ code: 'UPDATE_NOT_READY' }),
    );

    updater.emit('update-downloaded', { version: '0.1.0-beta.4' });
    service.installUpdate();
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it('deduplicates simultaneous manual checks', async () => {
    const { service, updater } = createService();
    let resolveCheck: (() => void) | undefined;
    updater.checkForUpdates.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolveCheck = () => resolve(null);
        }),
    );

    const first = service.checkForUpdates();
    const second = service.checkForUpdates();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    resolveCheck?.();
    await Promise.all([first, second]);
  });
});
