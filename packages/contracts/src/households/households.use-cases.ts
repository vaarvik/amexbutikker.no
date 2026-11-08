import type { HouseholdId, UserId } from '../shared/shared.model.js';

/** What a member sees of its household; never other members' ids. */
export interface HouseholdSummary {
  readonly householdId: HouseholdId;
  readonly memberCount: number;
}

export interface CreateHouseholdInput {
  readonly userId: UserId;
  readonly joinToken: string;
}

/** Starts a household with the caller as its only member. */
export interface CreateHousehold {
  /**
   * @throws ConflictError when the caller is already in a household.
   * @throws RateLimitedError when the caller creates too many.
   */
  execute(input: CreateHouseholdInput): Promise<HouseholdSummary>;
}

export interface JoinHouseholdInput {
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly joinToken: string;
}

/** Joins a household from its invite (the QR code another member shows). */
export interface JoinHousehold {
  /**
   * Joining the household the caller is already in does nothing.
   *
   * @throws NotFoundError when the household does not exist.
   * @throws ValidationError when the join token does not match.
   * @throws ConflictError when the caller is in another household, or the household is full.
   * @throws RateLimitedError when the caller tries too often (guessing tokens).
   */
  execute(input: JoinHouseholdInput): Promise<HouseholdSummary>;
}

export interface LeaveHouseholdInput {
  readonly userId: UserId;
}

/** Leaves the caller's household. What was shared stays with the others. */
export interface LeaveHousehold {
  /** Does nothing when the caller is in no household. */
  execute(input: LeaveHouseholdInput): Promise<void>;
}

export interface GetMyHouseholdInput {
  readonly userId: UserId;
}

export interface GetMyHousehold {
  /** @throws NotFoundError when the caller is in no household. */
  execute(input: GetMyHouseholdInput): Promise<HouseholdSummary>;
}

export interface AppendHouseholdRecordsInput {
  readonly userId: UserId;
  readonly sealed: readonly string[];
}

export interface AppendHouseholdRecordsOutput {
  /** The `seq` of each record, in the order given. */
  readonly seqs: readonly number[];
}

/** Shares sealed records with the caller's household. */
export interface AppendHouseholdRecords {
  /**
   * @throws NotFoundError when the caller is in no household.
   * @throws ValidationError for more than 50 records or a record that is not a sealed record.
   * @throws RateLimitedError when the caller sends too much.
   */
  execute(input: AppendHouseholdRecordsInput): Promise<AppendHouseholdRecordsOutput>;
}

export interface ListHouseholdRecordsInput {
  readonly userId: UserId;
  readonly afterSeq: number;
  /** 1..500; default 200. */
  readonly limit?: number;
}

export interface ListedHouseholdRecord {
  readonly seq: number;
  readonly sealed: string;
  /** Sent by the caller. Other authors are not identified. */
  readonly mine: boolean;
}

export interface ListHouseholdRecordsOutput {
  readonly records: readonly ListedHouseholdRecord[];
  /** More records after the last one returned. */
  readonly hasMore: boolean;
}

/** What the caller's household has shared since `afterSeq`, including records from before it joined. */
export interface ListHouseholdRecords {
  /** @throws NotFoundError when the caller is in no household. */
  execute(input: ListHouseholdRecordsInput): Promise<ListHouseholdRecordsOutput>;
}
