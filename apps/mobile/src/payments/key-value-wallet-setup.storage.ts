import type { KeyValueStorage } from '../shared/shared.ports';
import { WalletSetupStateSchema } from './payments.model';
import type { WalletSetupState } from './payments.model';
import type { WalletSetupStorage } from './payments.ports';

export interface KeyValueWalletSetupStorageConfig {
  readonly key: string;
}

export class KeyValueWalletSetupStorage implements WalletSetupStorage {
  public constructor(
    private readonly storage: KeyValueStorage,
    private readonly config: KeyValueWalletSetupStorageConfig,
  ) {}

  public async find(): Promise<WalletSetupState> {
    try {
      const parsed = WalletSetupStateSchema.safeParse(await this.storage.getItem(this.config.key));
      return parsed.success ? parsed.data : 'new';
    } catch {
      return 'new';
    }
  }

  public save(state: WalletSetupState): Promise<void> {
    return this.storage.setItem(this.config.key, state);
  }
}
