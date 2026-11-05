import type { KeyValueStorage } from '../shared/shared.ports';
import { NearbySnapshotSchema } from './places.model';
import type { NearbySnapshot } from './places.model';
import type { NearbyCache } from './places.ports';

export interface KeyValueNearbyCacheConfig {
  /** Storage key; bump it when the snapshot shape changes. */
  readonly key: string;
}

/** Stores the snapshot as JSON and validates it on the way back in. */
export class KeyValueNearbyCache implements NearbyCache {
  public constructor(
    private readonly storage: KeyValueStorage,
    private readonly config: KeyValueNearbyCacheConfig,
  ) {}

  public async find(): Promise<NearbySnapshot | null> {
    const raw = await this.storage.getItem(this.config.key);
    if (raw === null) {
      return null;
    }
    try {
      const parsed = NearbySnapshotSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  public save(snapshot: NearbySnapshot): Promise<void> {
    return this.storage.setItem(this.config.key, JSON.stringify(snapshot));
  }
}
