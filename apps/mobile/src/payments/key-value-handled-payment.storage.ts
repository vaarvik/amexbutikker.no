import { z } from 'zod';
import type { KeyValueStorage } from '../shared/shared.ports';
import { HandledPaymentSchema } from './payments.model';
import type { HandledPayment } from './payments.model';
import type { HandledPaymentStorage } from './payments.ports';

export interface KeyValueHandledPaymentStorageConfig {
  readonly key: string;
}

const StoredSchema = z.array(HandledPaymentSchema);

export class KeyValueHandledPaymentStorage implements HandledPaymentStorage {
  public constructor(
    private readonly storage: KeyValueStorage,
    private readonly config: KeyValueHandledPaymentStorageConfig,
  ) {}

  public async list(): Promise<HandledPayment[]> {
    try {
      const raw = await this.storage.getItem(this.config.key);
      const parsed = StoredSchema.safeParse(raw === null ? [] : JSON.parse(raw));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }

  public save(payments: readonly HandledPayment[]): Promise<void> {
    return this.storage.setItem(this.config.key, JSON.stringify(payments));
  }
}
