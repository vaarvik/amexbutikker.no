import type { ImportRunId } from '../ids.js';
import type { ImportRunReport, ImportSource } from '../model/import-run.js';

export interface ImportContext {
  readonly runId: ImportRunId;
  readonly startedAt: Date;
  /** When true, read and match everything but write nothing. */
  readonly dryRun: boolean;
  readonly signal?: AbortSignal;
}

/** Brings places, chains or evidence in from one external source. */
export interface SourceImporter {
  readonly source: ImportSource;

  /**
   * Runs one import.
   *
   * Invariants:
   * - Idempotent: a second run over the same source data changes nothing.
   * - Never deletes or updates evidence.
   * - Every imported entity stores its `sourceRef` and `fetchedAt`.
   *
   * @returns a report with `runId` and `source` from the context. A failure that stops the
   *   run is reported with `status: 'failed'` rather than thrown.
   * @throws only for programming errors and aborts (the signal's reason).
   */
  run(context: ImportContext): Promise<ImportRunReport>;
}
