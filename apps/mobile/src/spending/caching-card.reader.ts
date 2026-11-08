import { CardSchema } from '@amexbutikker/contracts';
import type { Card, CardReader } from '@amexbutikker/contracts';
import { z } from 'zod';
import type { KeyValueStorage } from '../shared/shared.ports';
import type { CardsApiClient } from './spending.ports';

export interface CachingCardReaderConfig {
  readonly key: string;
}

const StoredSchema = z.array(CardSchema);

/** The API's card list, kept on the phone so the picker works offline. */
export class CachingCardReader implements CardReader {
  public constructor(
    private readonly api: CardsApiClient,
    private readonly storage: KeyValueStorage,
    private readonly config: CachingCardReaderConfig,
  ) {}

  public async list(): Promise<Card[]> {
    try {
      const cards = [...(await this.api.list())];
      await this.storage.setItem(this.config.key, JSON.stringify(cards)).catch(() => undefined);
      return cards;
    } catch (error) {
      const stored = await this.stored();
      if (stored === null) {
        throw error;
      }
      return [...stored];
    }
  }

  private async stored(): Promise<readonly Card[] | null> {
    try {
      const raw = await this.storage.getItem(this.config.key);
      const parsed = StoredSchema.safeParse(raw === null ? null : JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
}
