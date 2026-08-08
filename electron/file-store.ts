import { promises as fs } from 'node:fs';
import path from 'node:path';

export class JsonFileStore<T> {
  constructor(
    private readonly filePath: string,
    private readonly fallback: T,
  ) {}

  async read(): Promise<T> {
    try {
      return JSON.parse(await fs.readFile(this.filePath, 'utf8')) as T;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Ignoring unreadable cache ${path.basename(this.filePath)}`);
      }
      return structuredClone(this.fallback);
    }
  }

  async write(value: T): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporary, this.filePath);
  }
}
