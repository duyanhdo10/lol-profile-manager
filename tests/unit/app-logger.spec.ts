import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AppLogger } from '../../electron/app-logger';

const roots: string[] = [];

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe('app diagnostics logger', () => {
  it('stores structured events and exposes recent diagnostics', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lpm-logger-'));
    roots.push(root);
    const logger = new AppLogger(root, '0.1.0-beta.1');
    await logger.initialize();
    await logger.warn('catalog.offline', { fromCache: true });

    const diagnostics = await logger.diagnostics();
    expect(diagnostics.appVersion).toBe('0.1.0-beta.1');
    expect(diagnostics.logPath).toContain(path.join('logs', 'main.log'));
    expect(diagnostics.recentEvents[0]).toMatchObject({ level: 'warn', event: 'catalog.offline' });
    expect(diagnostics.recentEvents[1]).toMatchObject({ level: 'info', event: 'app.start' });
  });
});
