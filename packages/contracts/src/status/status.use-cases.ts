export interface RefreshStaleStatusesInput {
  /** Snapshots calculated before this are recalculated. */
  readonly calculatedBefore: Date;
  /** Places per transaction. 1..1000. */
  readonly batchSize: number;
}

export interface RefreshStaleStatusesOutput {
  readonly refreshed: number;
}

/**
 * Recalculates stored statuses whose evidence has aged: decay moves answers over time (Ja can
 * fall back to Trolig ja), but a snapshot only changes when something recalculates it.
 */
export interface RefreshStaleStatuses {
  /** @throws ValidationError when `batchSize` is out of range. */
  execute(input: RefreshStaleStatusesInput): Promise<RefreshStaleStatusesOutput>;
}
