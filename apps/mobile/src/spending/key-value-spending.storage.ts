import type { KeyValueStorage } from '../shared/shared.ports';
import { EMPTY_SPENDING_STATE, SpendingStateSchema } from './spending.model';
import type { SpendingState } from './spending.model';
import type { SpendingStorage } from './spending.ports';

export interface KeyValueSpendingStorageConfig {
  readonly key: string;
}

/** One JSON document. A missing or unreadable document reads as the empty state. */
export class KeyValueSpendingStorage implements SpendingStorage {
  public constructor(
    private readonly storage: KeyValueStorage,
    private readonly config: KeyValueSpendingStorageConfig,
  ) {}

  public async find(): Promise<SpendingState> {
    const raw = await this.storage.getItem(this.config.key);
    if (raw === null) {
      return EMPTY_SPENDING_STATE;
    }
    try {
      const parsed = SpendingStateSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : EMPTY_SPENDING_STATE;
    } catch {
      return EMPTY_SPENDING_STATE;
    }
  }

  public async save(state: SpendingState): Promise<void> {
    await this.storage.setItem(this.config.key, JSON.stringify(state));
  }
}
