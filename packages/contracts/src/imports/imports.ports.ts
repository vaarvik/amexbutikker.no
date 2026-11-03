import type { ImportRunReport, ImportSource } from './imports.model.js';
import type { ImportRunId } from '../shared/shared.model.js';

/** Records import runs in `import_runs`. */
export interface ImportRunWriter {
  /**
   * Records that a run started, so a crashed run is still visible.
   *
   * @throws ConflictError when the run id exists.
   */
  start(runId: ImportRunId, source: ImportSource, startedAt: Date, dryRun: boolean): Promise<void>;

  /**
   * Stores the final report of a started run.
   *
   * @throws NotFoundError when the run was never started.
   * @throws ConflictError when the run already finished.
   */
  finish(report: ImportRunReport): Promise<void>;
}

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
