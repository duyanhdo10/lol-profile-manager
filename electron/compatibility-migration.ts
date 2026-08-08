import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CompatibilityRecord, ProfileField } from '../src/shared/models';
import { JsonFileStore } from './file-store';

const fields = new Set<ProfileField>([
  'background',
  'icon',
  'challengeShowcase',
  'regalia',
  'status',
  'rank',
]);

function validRecord(value: unknown): value is CompatibilityRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const itemId = record['itemId'];
  return (
    typeof record['clientVersion'] === 'string' &&
    record['clientVersion'].length > 0 &&
    record['clientVersion'].length <= 100 &&
    fields.has(record['field'] as ProfileField) &&
    ((typeof itemId === 'string' && itemId.length > 0 && itemId.length <= 100) ||
      (typeof itemId === 'number' && Number.isSafeInteger(itemId) && itemId >= 0)) &&
    typeof record['compatible'] === 'boolean' &&
    typeof record['checkedAt'] === 'string' &&
    Number.isFinite(Date.parse(record['checkedAt']))
  );
}

export interface CompatibilityMigrationResult {
  migrated: boolean;
  imported: number;
  source?: string;
}

export async function migrateLegacyCompatibility(
  appDataPath: string,
  newUserDataPath: string,
): Promise<CompatibilityMigrationResult> {
  const destination = path.join(newUserDataPath, 'compatibility.json');
  try {
    await access(destination);
    return { migrated: false, imported: 0 };
  } catch {
    /* first run */
  }

  const candidates = [
    path.join(appDataPath, 'League Profile Tool', 'compatibility.json'),
    path.join(appDataPath, 'league-profile-tool', 'compatibility.json'),
  ];
  for (const source of candidates) {
    try {
      const parsed: unknown = JSON.parse(await readFile(source, 'utf8'));
      if (!Array.isArray(parsed)) continue;
      const records = parsed.filter(validRecord).slice(-2_000);
      if (records.length === 0) continue;
      await new JsonFileStore<CompatibilityRecord[]>(destination, []).write(records);
      return { migrated: true, imported: records.length, source };
    } catch {
      /* try next legacy location */
    }
  }
  return { migrated: false, imported: 0 };
}
