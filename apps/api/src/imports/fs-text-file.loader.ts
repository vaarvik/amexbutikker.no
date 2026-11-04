import { readFile } from 'node:fs/promises';
import type { TextFileLoader } from './imports.ports.js';

export class FsTextFileLoader implements TextFileLoader {
  public load(path: string): Promise<string> {
    return readFile(path, 'utf8');
  }
}
