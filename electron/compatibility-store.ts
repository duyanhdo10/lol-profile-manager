import path from 'node:path';
import type { CompatibilityRecord, ProfileField } from '../src/shared/models';
import { JsonFileStore } from './file-store';

export class CompatibilityStore {
  private readonly store: JsonFileStore<CompatibilityRecord[]>;

  constructor(userDataPath: string) {
    this.store = new JsonFileStore(path.join(userDataPath, 'compatibility.json'), []);
  }

  read(): Promise<CompatibilityRecord[]> {
    return this.store.read();
  }

  async record(
    clientVersion: string,
    field: ProfileField,
    itemId: string | number,
    compatible: boolean,
  ): Promise<void> {
    const records = (await this.store.read()).filter(
      (entry) => !(entry.clientVersion === clientVersion && entry.field === field && entry.itemId === itemId),
    );
    records.push({ clientVersion, field, itemId, compatible, checkedAt: new Date().toISOString() });
    await this.store.write(records.slice(-2_000));
  }
}
