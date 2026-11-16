import type { KeyValueStorage } from '../shared/shared.ports';
import type { IdGenerator, MemberIdProvider } from './spending.ports';

export interface KeyValueMemberIdProviderConfig {
  readonly key: string;
}

/** Makes this phone's member id on first use and keeps it. */
export class KeyValueMemberIdProvider implements MemberIdProvider {
  private pending: Promise<string> | null = null;

  public constructor(
    private readonly storage: KeyValueStorage,
    private readonly ids: IdGenerator,
    private readonly config: KeyValueMemberIdProviderConfig,
  ) {}

  public current(): Promise<string> {
    // One id even when several callers ask before the first is stored.
    this.pending ??= this.load().catch((error: unknown) => {
      this.pending = null;
      throw error;
    });
    return this.pending;
  }

  private async load(): Promise<string> {
    const stored = await this.storage.getItem(this.config.key);
    if (stored !== null && stored !== '') {
      return stored;
    }
    const id = this.ids.next();
    await this.storage.setItem(this.config.key, id);
    return id;
  }
}
