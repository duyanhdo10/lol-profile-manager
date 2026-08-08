import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DiagnosticEvent, DiagnosticsSnapshot } from '../src/shared/models';

const MAX_LOG_BYTES = 1_000_000;
const TRIM_TO_BYTES = 600_000;

export class AppLogger {
  readonly logPath: string;

  constructor(
    private readonly userDataPath: string,
    private readonly appVersion: string,
  ) {
    this.logPath = path.join(userDataPath, 'logs', 'main.log');
  }

  async initialize(): Promise<void> {
    await mkdir(path.dirname(this.logPath), { recursive: true });
    await this.info('app.start', { appVersion: this.appVersion });
  }

  info(event: string, details?: Record<string, unknown>): Promise<void> {
    return this.write('info', event, details);
  }

  warn(event: string, details?: Record<string, unknown>): Promise<void> {
    return this.write('warn', event, details);
  }

  error(event: string, error: unknown, details?: Record<string, unknown>): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    return this.write('error', event, { ...details, message });
  }

  async diagnostics(): Promise<DiagnosticsSnapshot> {
    let content = '';
    try {
      content = await readFile(this.logPath, 'utf8');
    } catch {
      /* no events yet */
    }
    const recentEvents = content
      .trim()
      .split(/\r?\n/)
      .slice(-80)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as DiagnosticEvent];
        } catch {
          return [];
        }
      })
      .reverse();
    return {
      appVersion: this.appVersion,
      userDataPath: this.userDataPath,
      logPath: this.logPath,
      recentEvents,
    };
  }

  private async write(
    level: DiagnosticEvent['level'],
    event: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const entry: DiagnosticEvent = { timestamp: new Date().toISOString(), level, event, details };
    try {
      await mkdir(path.dirname(this.logPath), { recursive: true });
      await this.trimIfNeeded();
      await appendFile(this.logPath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch {
      /* diagnostics must never interrupt the app */
    }
  }

  private async trimIfNeeded(): Promise<void> {
    let size = 0;
    try {
      size = (await stat(this.logPath)).size;
    } catch {
      return;
    }
    if (size < MAX_LOG_BYTES) return;
    const content = await readFile(this.logPath);
    const tail = content.subarray(Math.max(0, content.length - TRIM_TO_BYTES));
    const firstLineEnd = tail.indexOf(10);
    await writeFile(this.logPath, firstLineEnd >= 0 ? tail.subarray(firstLineEnd + 1) : tail);
  }
}
