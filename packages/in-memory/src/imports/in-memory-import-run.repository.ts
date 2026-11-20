import { ConflictError, NotFoundError } from '@amexbutikker/contracts';
import type {
  ImportRunId,
  ImportRunReader,
  ImportRunReport,
  ImportRunWriter,
  ImportSource,
} from '@amexbutikker/contracts';
import type { InMemoryTables } from '../shared/shared.ports.js';

export class InMemoryImportRunRepository implements ImportRunReader, ImportRunWriter {
  public constructor(private readonly tables: InMemoryTables) {}

  public create(
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

  public saveReport(report: ImportRunReport): Promise<void> {
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

  public findLastSucceededAt(source: ImportSource): Promise<Date | null> {
    const starts = [...this.tables.importRuns.values()]
      .filter((run) => run.source === source && !run.dryRun && run.report?.status === 'succeeded')
      .map((run) => run.startedAt.getTime());
    return Promise.resolve(starts.length === 0 ? null : new Date(Math.max(...starts)));
  }
}
