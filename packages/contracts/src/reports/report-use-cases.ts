import type { AcceptanceResult } from '../evidence/evidence.js';
import type { PlaceId, UserId } from '../shared/ids.js';
import type { ChainHint, PlaceStatus } from '../status/place-status.js';

export interface SubmitReportInput {
  readonly userId: UserId;
  readonly placeId: PlaceId;
  readonly result: AcceptanceResult;
  readonly note?: string;
}

export interface StatusChangeOutput {
  readonly status: PlaceStatus;
  readonly chainHint: ChainHint | null;
}

/** "Det funket" / "Ble avvist". */
export interface SubmitReport {
  /**
   * Appends a user_report, then recalculates the place status and the chain hint, in one unit of work.
   * A user has at most one active report per place: the new one supersedes the old.
   *
   * @throws NotFoundError when the place does not exist.
   * @throws ValidationError when the note is longer than 500 characters.
   * @throws RateLimitedError when the user reports too often.
   */
  execute(input: SubmitReportInput): Promise<StatusChangeOutput>;
}

export interface RemoveMyReportInput {
  readonly userId: UserId;
  readonly placeId: PlaceId;
}

/** A user withdraws their report. */
export interface RemoveMyReport {
  /**
   * Appends a `withdrawn` user_report, then recalculates as SubmitReport does.
   *
   * @throws NotFoundError when the place does not exist, or the user has no active report on it.
   * @throws RateLimitedError when the user reports too often.
   */
  execute(input: RemoveMyReportInput): Promise<StatusChangeOutput>;
}
