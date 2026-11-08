import { ValidationError } from '@amexbutikker/contracts';
import type { Clock } from '@amexbutikker/contracts';
import { ApiError } from '../shared/fetch-json.transport';
import { SpendingChangeSchema } from '../spending/spending.model';
import type { SpendingChange } from '../spending/spending.model';
import type {
  SpendingChangeNotifier,
  SpendingService,
  SpendingStateCalculator,
  SpendingStorage,
} from '../spending/spending.ports';
import type { HouseholdStatus, HouseholdSyncResult, StoredHousehold } from './households.model';
import type {
  HouseholdCipher,
  HouseholdInviteTranslator,
  HouseholdService,
  HouseholdStorage,
  HouseholdsApiClient,
} from './households.ports';

export interface SyncingHouseholdServiceConfig {
  /** Records per append request; the API takes at most 50. */
  readonly batchSize: number;
}

/**
 * Shares spending through sealed records. Local changes are queued (`changed`) and sent on the
 * next sync; records from the others are opened and handed to the spending service. Only one
 * sync runs at a time: a sync asked for while one runs is folded into a second pass.
 */
export class SyncingHouseholdService implements HouseholdService, SpendingChangeNotifier {
  private running: Promise<HouseholdSyncResult> | null = null;
  private again = false;

  public constructor(
    private readonly api: HouseholdsApiClient,
    private readonly cipher: HouseholdCipher,
    private readonly invites: HouseholdInviteTranslator,
    private readonly storage: HouseholdStorage,
    private readonly spendingStorage: SpendingStorage,
    private readonly replay: SpendingStateCalculator,
    private readonly spending: SpendingService,
    private readonly clock: Clock,
    private readonly config: SyncingHouseholdServiceConfig,
  ) {}

  public async status(): Promise<HouseholdStatus> {
    const stored = await this.storage.find();
    return stored === null ? { kind: 'alone' } : this.present(stored);
  }

  public async create(): Promise<HouseholdStatus> {
    const existing = await this.storage.find();
    if (existing !== null) {
      return this.present(existing);
    }
    const key = this.cipher.newKey();
    const created = await this.api.create(this.cipher.joinToken(key));
    const state = await this.spendingStorage.find();
    await this.storage.save({
      invite: { householdId: created.householdId, key },
      cursor: 0,
      pending: this.replay.changesFor(state, this.now()),
      memberCount: created.memberCount,
      syncedAt: null,
    });
    await this.sync();
    return this.status();
  }

  public async join(link: string): Promise<HouseholdStatus> {
    const invite = this.invites.fromLink(link);
    if (invite === null) {
      throw new ValidationError('This is not a household invite.');
    }
    const existing = await this.storage.find();
    if (existing?.invite.householdId === invite.householdId) {
      return this.present(existing);
    }
    if (existing !== null) {
      await this.leave();
    }
    const joined = await this.api.join(invite.householdId, this.cipher.joinToken(invite.key));
    const state = await this.spendingStorage.find();
    await this.storage.save({
      invite,
      cursor: 0,
      // The household's card and goals win; this phone brings its purchases and own goals.
      pending: this.replay
        .changesFor(state, this.now())
        .filter((change) => change.kind !== 'card_set'),
      memberCount: joined.memberCount,
      syncedAt: null,
    });
    await this.sync();
    return this.status();
  }

  public async leave(): Promise<HouseholdStatus> {
    if ((await this.storage.find()) !== null) {
      try {
        await this.api.leave();
      } catch (error) {
        // Already out of it on the server: forget it here too.
        if (!(error instanceof ApiError && error.status === 404)) {
          throw error;
        }
      }
      await this.storage.save(null);
    }
    return { kind: 'alone' };
  }

  public async changed(changes: readonly SpendingChange[]): Promise<void> {
    const stored = await this.storage.find();
    if (stored === null || changes.length === 0) {
      return;
    }
    await this.storage.save({ ...stored, pending: [...stored.pending, ...changes] });
    void this.sync();
  }

  public sync(): Promise<HouseholdSyncResult> {
    if (this.running !== null) {
      this.again = true;
      return this.running;
    }
    this.running = this.syncRepeatedly().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async syncRepeatedly(): Promise<HouseholdSyncResult> {
    for (;;) {
      this.again = false;
      const result = await this.syncOnce();
      if (result.kind !== 'synced' || !this.askedAgain()) {
        return result;
      }
    }
  }

  /** Whether another sync was asked for while the last one ran. */
  private askedAgain(): boolean {
    return this.again;
  }

  private async syncOnce(): Promise<HouseholdSyncResult> {
    const start = await this.storage.find();
    if (start === null) {
      return { kind: 'alone' };
    }
    try {
      const household = await this.api.find();
      if (household?.householdId !== start.invite.householdId) {
        await this.storage.save(null);
        return { kind: 'gone' };
      }
      const sent = await this.push(start.invite.key);
      const received = await this.pull(start.invite.key);
      const latest = await this.storage.find();
      if (latest !== null) {
        await this.storage.save({
          ...latest,
          memberCount: household.memberCount,
          syncedAt: this.now(),
        });
      }
      return { kind: 'synced', sent, received };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        await this.storage.save(null);
        return { kind: 'gone' };
      }
      return { kind: 'offline' };
    }
  }

  /** Sends pending changes in batches; each batch leaves the queue once the API has it. */
  private async push(key: string): Promise<number> {
    let sent = 0;
    for (;;) {
      const stored = await this.storage.find();
      if (stored === null || stored.pending.length === 0) {
        return sent;
      }
      const batch = stored.pending.slice(0, this.config.batchSize);
      await this.api.append(batch.map((change) => this.cipher.seal(key, JSON.stringify(change))));
      sent += batch.length;
      // Read again: changes may have been queued while the request ran.
      const after = await this.storage.find();
      if (after === null) {
        return sent;
      }
      await this.storage.save({ ...after, pending: after.pending.slice(batch.length) });
    }
  }

  /** Reads records after the cursor, page by page, and merges the others' changes. */
  private async pull(key: string): Promise<number> {
    let received = 0;
    for (;;) {
      const stored = await this.storage.find();
      if (stored === null) {
        return received;
      }
      const page = await this.api.list(stored.cursor);
      const changes = page.records
        .filter((record) => !record.mine)
        .map((record) => this.open(key, record.sealed))
        .filter((change): change is SpendingChange => change !== null);
      if (changes.length > 0) {
        await this.spending.receive(changes);
        received += changes.length;
      }
      const last = page.records.at(-1);
      if (last !== undefined) {
        const after = (await this.storage.find()) ?? stored;
        await this.storage.save({ ...after, cursor: last.seq });
      }
      if (!page.hasMore || last === undefined) {
        return received;
      }
    }
  }

  /** null for a record this key cannot open, or one from a newer app version. */
  private open(key: string, sealed: string): SpendingChange | null {
    try {
      const parsed = SpendingChangeSchema.safeParse(JSON.parse(this.cipher.open(key, sealed)));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private present(stored: StoredHousehold): HouseholdStatus {
    return {
      kind: 'member',
      memberCount: stored.memberCount,
      inviteLink: this.invites.toLink(stored.invite),
      syncedAt: stored.syncedAt === null ? null : new Date(stored.syncedAt),
    };
  }

  private now(): string {
    return this.clock.now().toISOString();
  }
}
