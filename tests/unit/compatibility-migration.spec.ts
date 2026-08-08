import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateLegacyCompatibility } from '../../electron/compatibility-migration';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function workspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lpm-migration-'));
  roots.push(root);
  return { appData: path.join(root, 'appdata'), userData: path.join(root, 'new-userdata') };
}

describe('legacy compatibility migration', () => {
  it('imports only valid records without modifying the legacy file', async () => {
    const { appData, userData } = await workspace();
    const legacy = path.join(appData, 'League Profile Tool');
    await mkdir(legacy, { recursive: true });
    const original = JSON.stringify([
      {
        clientVersion: '16.15.1',
        field: 'icon',
        itemId: 7,
        compatible: false,
        checkedAt: '2026-08-07T00:00:00.000Z',
      },
      { clientVersion: '', field: 'fake', itemId: -1, compatible: 'no', checkedAt: 'invalid' },
    ]);
    await writeFile(path.join(legacy, 'compatibility.json'), original);

    const result = await migrateLegacyCompatibility(appData, userData);
    expect(result).toMatchObject({ migrated: true, imported: 1 });
    expect(JSON.parse(await readFile(path.join(userData, 'compatibility.json'), 'utf8'))).toHaveLength(1);
    expect(await readFile(path.join(legacy, 'compatibility.json'), 'utf8')).toBe(original);
  });

  it('does not overwrite an existing destination', async () => {
    const { appData, userData } = await workspace();
    await mkdir(userData, { recursive: true });
    await writeFile(path.join(userData, 'compatibility.json'), '[]');
    expect(await migrateLegacyCompatibility(appData, userData)).toEqual({ migrated: false, imported: 0 });
  });

  it('returns a clean result when legacy data is missing or unreadable', async () => {
    const { appData, userData } = await workspace();
    await mkdir(path.join(appData, 'league-profile-tool'), { recursive: true });
    await writeFile(path.join(appData, 'league-profile-tool', 'compatibility.json'), '{bad');
    expect(await migrateLegacyCompatibility(appData, userData)).toEqual({ migrated: false, imported: 0 });
  });
});
