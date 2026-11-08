import { ConflictError, NotFoundError } from '@amexbutikker/contracts';
import type {
  Household,
  HouseholdId,
  HouseholdMembership,
  HouseholdReader,
  HouseholdRecord,
  HouseholdWriter,
  NewHouseholdRecord,
  UserId,
} from '@amexbutikker/contracts';
import type { InMemoryTables } from '../shared/shared.ports.js';

export class InMemoryHouseholdRepository implements HouseholdReader, HouseholdWriter {
  public constructor(private readonly tables: InMemoryTables) {}

  public create(household: Household): Promise<void> {
    if (this.tables.households.has(household.id)) {
      return Promise.reject(new ConflictError(`Household ${household.id} exists.`));
    }
    this.tables.households.set(household.id, household);
    return Promise.resolve();
  }

  public saveMembership(membership: HouseholdMembership): Promise<void> {
    if (!this.tables.households.has(membership.householdId)) {
      return Promise.reject(new NotFoundError('Household', membership.householdId));
    }
    this.tables.householdMembers.set(membership.userId, membership);
    return Promise.resolve();
  }

  public appendRecords(records: readonly NewHouseholdRecord[]): Promise<HouseholdRecord[]> {
    // One by one, so each record's seq counts the ones before it.
    const appended: HouseholdRecord[] = [];
    for (const record of records) {
      const withSeq = { ...record, seq: this.tables.householdRecords.length + 1 };
      this.tables.householdRecords.push(withSeq);
      appended.push(withSeq);
    }
    return Promise.resolve(appended);
  }

  public findById(id: HouseholdId): Promise<Household | null> {
    return Promise.resolve(this.tables.households.get(id) ?? null);
  }

  public findMembership(userId: UserId): Promise<HouseholdMembership | null> {
    const membership = this.tables.householdMembers.get(userId);
    return Promise.resolve(membership?.leftAt === null ? membership : null);
  }

  public listMembers(id: HouseholdId): Promise<HouseholdMembership[]> {
    return Promise.resolve(
      [...this.tables.householdMembers.values()]
        .filter((m) => m.householdId === id && m.leftAt === null)
        .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime()),
    );
  }

  public listRecords(id: HouseholdId, afterSeq: number, limit: number): Promise<HouseholdRecord[]> {
    return Promise.resolve(
      this.tables.householdRecords
        .filter((record) => record.householdId === id && record.seq > afterSeq)
        .slice(0, limit),
    );
  }
}
