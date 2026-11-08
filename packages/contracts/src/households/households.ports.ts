import type { HouseholdId, UserId } from '../shared/shared.model.js';
import type {
  Household,
  HouseholdMembership,
  HouseholdRecord,
  NewHouseholdRecord,
} from './households.model.js';

/** Reads households, who is in them and what they have shared. */
export interface HouseholdReader {
  /** null when no household has this id. */
  findById(id: HouseholdId): Promise<Household | null>;
  /** The user's current membership; null when the user is in no household (or has left). */
  findMembership(userId: UserId): Promise<HouseholdMembership | null>;
  /** Current members (not those who left), oldest first. */
  listMembers(id: HouseholdId): Promise<HouseholdMembership[]>;
  /** Records with `seq > afterSeq`, oldest first, at most `limit`. */
  listRecords(id: HouseholdId, afterSeq: number, limit: number): Promise<HouseholdRecord[]>;
}

/** Writes households. Records are append-only, like evidence. */
export interface HouseholdWriter {
  /** @throws ConflictError when a household with this id exists. */
  create(household: Household): Promise<void>;
  /**
   * Adds the membership, or replaces the user's current one (to set `leftAt`).
   *
   * @throws NotFoundError when the household does not exist.
   */
  saveMembership(membership: HouseholdMembership): Promise<void>;
  /** @returns the records with their `seq`, in the order given. */
  appendRecords(records: readonly NewHouseholdRecord[]): Promise<HouseholdRecord[]>;
}

/** Hashes join tokens for storage and comparison. */
export interface JoinTokenHasher {
  /** SHA-256, hex. */
  hash(joinToken: string): string;
}
