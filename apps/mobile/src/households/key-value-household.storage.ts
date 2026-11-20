import type { KeyValueStorage } from '../shared/shared.ports';
import { HouseholdInviteSchema, HouseholdProgressSchema } from './households.model';
import type { StoredHousehold } from './households.model';
import type { HouseholdStorage } from './households.ports';

export interface KeyValueHouseholdStorageConfig {
  readonly key: string;
}

/**
 * The invite (with the key) in secure storage; the cursor and pending changes, which can outgrow
 * the keychain's size limit, in plain storage next to the spending document they come from. On the
 * web both are localStorage, so the progress has its own key or it would overwrite the invite.
 */
export class KeyValueHouseholdStorage implements HouseholdStorage {
  public constructor(
    private readonly secure: KeyValueStorage,
    private readonly plain: KeyValueStorage,
    private readonly config: KeyValueHouseholdStorageConfig,
  ) {}

  public async find(): Promise<StoredHousehold | null> {
    try {
      const rawInvite = await this.secure.getItem(this.config.key);
      if (rawInvite === null) {
        return null;
      }
      const invite = HouseholdInviteSchema.safeParse(JSON.parse(rawInvite));
      if (!invite.success) {
        return null;
      }
      const rawProgress = await this.plain.getItem(this.progressKey());
      const progress = HouseholdProgressSchema.safeParse(
        rawProgress === null ? null : JSON.parse(rawProgress),
      );
      return {
        invite: invite.data,
        ...(progress.success
          ? progress.data
          : { cursor: 0, pending: [], memberCount: 1, syncedAt: null }),
      };
    } catch {
      return null;
    }
  }

  public async save(household: StoredHousehold | null): Promise<void> {
    if (household === null) {
      await this.secure.removeItem(this.config.key);
      await this.plain.removeItem(this.progressKey());
      return;
    }
    await this.secure.setItem(this.config.key, JSON.stringify(household.invite));
    await this.plain.setItem(
      this.progressKey(),
      JSON.stringify({
        cursor: household.cursor,
        pending: household.pending,
        memberCount: household.memberCount,
        syncedAt: household.syncedAt,
      }),
    );
  }

  private progressKey(): string {
    return `${this.config.key}:progress`;
  }
}
