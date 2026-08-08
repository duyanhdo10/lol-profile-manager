import type { AppUpdater } from 'electron-updater';
import type { UpdateErrorCode, UpdateState } from '../src/shared/models';

interface UpdateLogger {
  info(event: string, details?: Record<string, unknown>): Promise<void>;
  error(event: string, error: unknown, details?: Record<string, unknown>): Promise<void>;
}

interface UpdateServiceOptions {
  enabled: boolean;
  logger: UpdateLogger;
  now?: () => Date;
}

export class UpdateServiceError extends Error {
  constructor(readonly code: UpdateErrorCode) {
    super(code);
    this.name = 'UpdateServiceError';
  }
}

export class UpdateService {
  private state: UpdateState;
  private started = false;
  private checkPromise: Promise<UpdateState> | null = null;
  private readonly listeners = new Set<(state: UpdateState) => void>();
  private readonly now: () => Date;

  constructor(
    private readonly updater: AppUpdater,
    private readonly options: UpdateServiceOptions,
  ) {
    this.state = { status: options.enabled ? 'idle' : 'disabled' };
    this.now = options.now ?? (() => new Date());
  }

  start(): void {
    if (this.started || !this.options.enabled) return;
    this.started = true;
    this.updater.autoDownload = true;
    this.updater.autoInstallOnAppQuit = false;

    this.updater.on('checking-for-update', () => this.transition({ status: 'checking' }));
    this.updater.on('update-available', (info) => {
      this.transition({
        status: 'downloading',
        availableVersion: info.version,
        percent: 0,
        checkedAt: this.timestamp(),
      });
    });
    this.updater.on('download-progress', (progress) => {
      this.transition({
        status: 'downloading',
        availableVersion: this.state.availableVersion,
        percent: Math.min(100, Math.max(0, progress.percent)),
        transferred: progress.transferred,
        total: progress.total,
        checkedAt: this.state.checkedAt,
      });
    });
    this.updater.on('update-downloaded', (info) => {
      this.transition({
        status: 'downloaded',
        availableVersion: info.version,
        percent: 100,
        transferred: this.state.total,
        total: this.state.total,
        checkedAt: this.state.checkedAt ?? this.timestamp(),
      });
    });
    this.updater.on('update-not-available', () => {
      this.transition({ status: 'upToDate', checkedAt: this.timestamp() });
    });
    this.updater.on('update-cancelled', () => {
      this.fail('UPDATE_DOWNLOAD_FAILED', new Error('Update download was cancelled.'));
    });
    this.updater.on('error', (error) => {
      const code = this.state.status === 'downloading' ? 'UPDATE_DOWNLOAD_FAILED' : 'UPDATE_CHECK_FAILED';
      this.fail(code, error);
    });
  }

  getState(): UpdateState {
    return { ...this.state };
  }

  onState(listener: (state: UpdateState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  checkForUpdates(): Promise<UpdateState> {
    if (!this.options.enabled) return Promise.resolve(this.getState());
    if (this.state.status === 'downloaded' || this.state.status === 'downloading') {
      return Promise.resolve(this.getState());
    }
    if (this.checkPromise) return this.checkPromise;

    this.transition({ status: 'checking' });
    this.checkPromise = this.updater
      .checkForUpdates()
      .then(() => this.getState())
      .catch((error: unknown) => {
        if (this.state.status !== 'error') this.fail('UPDATE_CHECK_FAILED', error);
        return this.getState();
      })
      .finally(() => {
        this.checkPromise = null;
      });
    return this.checkPromise;
  }

  installUpdate(): void {
    if (this.state.status !== 'downloaded') throw new UpdateServiceError('UPDATE_NOT_READY');
    void this.options.logger.info('update.install', {
      version: this.state.availableVersion,
    });
    this.updater.quitAndInstall(false, true);
  }

  private fail(code: UpdateErrorCode, error: unknown): void {
    void this.options.logger.error('update.failed', error, {
      code,
      phase: this.state.status,
    });
    this.transition({
      status: 'error',
      availableVersion: this.state.availableVersion,
      checkedAt: this.timestamp(),
      errorCode: code,
    });
  }

  private transition(state: UpdateState): void {
    this.state = state;
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}
