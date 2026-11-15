import { z } from 'zod';
import type { KeyValueStorage } from '../shared/shared.ports';
import { AskedPlaceSchema } from './payments.model';
import type { AskedPlace } from './payments.model';
import type { AskedPlaceStorage } from './payments.ports';

export interface KeyValueAskedPlaceStorageConfig {
  readonly key: string;
}

const StoredSchema = z.array(AskedPlaceSchema);

export class KeyValueAskedPlaceStorage implements AskedPlaceStorage {
  public constructor(
    private readonly storage: KeyValueStorage,
    private readonly config: KeyValueAskedPlaceStorageConfig,
  ) {}

  public async list(): Promise<AskedPlace[]> {
    try {
      const raw = await this.storage.getItem(this.config.key);
      const parsed = StoredSchema.safeParse(raw === null ? [] : JSON.parse(raw));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }

  public save(places: readonly AskedPlace[]): Promise<void> {
    return this.storage.setItem(this.config.key, JSON.stringify(places));
  }
}
