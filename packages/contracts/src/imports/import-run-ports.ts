import type { ImportRunId } from '../shared/ids.js';
import type { ImportRunReport, ImportSource } from './import-run.js';

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
