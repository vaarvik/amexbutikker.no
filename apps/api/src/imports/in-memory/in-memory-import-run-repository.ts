import { ConflictError, NotFoundError } from '@amexbutikker/contracts';
import type {
  ImportRunId,
  ImportRunReport,
  ImportRunWriter,
  ImportSource,
} from '@amexbutikker/contracts';
import type { InMemoryTables } from '../../shared/in-memory/in-memory-tables.js';

export class InMemoryImportRunRepository implements ImportRunWriter {
  public constructor(private readonly tables: InMemoryTables) {}

  public start(
    runId: ImportRunId,
    source: ImportSource,
    startedAt: Date,
    dryRun: boolean,
  ): Promise<void> {
    if (this.tables.importRuns.has(runId)) {
      return Promise.reject(new ConflictError(`Import run ${runId} already exists.`));
    }
    this.tables.importRuns.set(runId, { runId, source, startedAt, dryRun, report: null });
    return Promise.resolve();
  }

  public finish(report: ImportRunReport): Promise<void> {
    const run = this.tables.importRuns.get(report.runId);
    if (run === undefined) {
      return Promise.reject(new NotFoundError('Import run', report.runId));
    }
    if (run.report !== null) {
      return Promise.reject(new ConflictError(`Import run ${report.runId} already finished.`));
    }
    this.tables.importRuns.set(report.runId, { ...run, report });
    return Promise.resolve();
  }
}
