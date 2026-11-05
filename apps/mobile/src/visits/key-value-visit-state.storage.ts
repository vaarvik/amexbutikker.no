import type { KeyValueStorage } from '../shared/shared.ports';
import { EMPTY_VISIT_STATE, VisitStateSchema } from './visits.model';
import type { VisitState } from './visits.model';
import type { VisitStateStorage } from './visits.ports';

export interface KeyValueVisitStateStorageConfig {
  readonly key: string;
}

/** One JSON document. A missing or unreadable document reads as the empty, disabled state. */
export class KeyValueVisitStateStorage implements VisitStateStorage {
  public constructor(
    private readonly storage: KeyValueStorage,
    private readonly config: KeyValueVisitStateStorageConfig,
  ) {}

  public async find(): Promise<VisitState> {
    const raw = await this.storage.getItem(this.config.key);
    if (raw === null) {
      return EMPTY_VISIT_STATE;
    }
    try {
      const parsed = VisitStateSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : EMPTY_VISIT_STATE;
    } catch {
      return EMPTY_VISIT_STATE;
    }
  }

  public async save(state: VisitState): Promise<void> {
    await this.storage.setItem(this.config.key, JSON.stringify(state));
  }
}
