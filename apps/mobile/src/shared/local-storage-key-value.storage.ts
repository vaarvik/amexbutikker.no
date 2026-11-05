import type { KeyValueStorage, WebStorage } from './shared.ports';

/**
 * KeyValueStorage over the browser's localStorage; the web has no keychain. Without
 * localStorage (static rendering in Node, some private modes) nothing is kept.
 */
export class LocalStorageKeyValueStorage implements KeyValueStorage {
  public constructor(private readonly storage: WebStorage | undefined) {}

  public getItem(key: string): Promise<string | null> {
    return Promise.resolve(this.storage?.getItem(key) ?? null);
  }

  public setItem(key: string, value: string): Promise<void> {
    this.storage?.setItem(key, value);
    return Promise.resolve();
  }

  public removeItem(key: string): Promise<void> {
    this.storage?.removeItem(key);
    return Promise.resolve();
  }
}
