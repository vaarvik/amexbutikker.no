import { ConflictError, NotFoundError } from '@amexbutikker/contracts';
import type {
  ImportRunId,
  ImportRunReport,
  ImportRunWriter,
  ImportSource,
} from '@amexbutikker/contracts';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Database } from '../../shared/postgres/database.js';
import type { DatabaseErrorTranslator } from '../../shared/postgres/database-error-translator.js';

export class PgImportRunRepository implements ImportRunWriter {
  public constructor(
    private readonly db: Kysely<Database>,
    private readonly errors: DatabaseErrorTranslator,
  ) {}

  public async start(
    runId: ImportRunId,
    source: ImportSource,
    startedAt: Date,
    dryRun: boolean,
  ): Promise<void> {
    try {
      await sql`
        INSERT INTO import_runs (id, source, dry_run, started_at) VALUES (${runId}, ${source}, ${dryRun}, ${startedAt})
      `.execute(this.db);
    } catch (error) {
      throw this.errors.translate(error, {
        import_runs_pkey: () => new ConflictError(`Import run ${runId} already exists.`),
      });
    }
  }

  public async finish(report: ImportRunReport): Promise<void> {
    const result = await sql`
      UPDATE import_runs SET
        finished_at = ${report.finishedAt}, status = ${report.status}, fetched_at = ${report.fetchedAt},
        counts = ${JSON.stringify(report.counts)}::jsonb, metrics = ${JSON.stringify(report.metrics)}::jsonb,
        messages = ${JSON.stringify(report.messages)}::jsonb
      WHERE id = ${report.runId} AND finished_at IS NULL
    `.execute(this.db);
    if (result.numAffectedRows !== 0n) {
      return;
    }
    const { rows } = await sql`SELECT 1 FROM import_runs WHERE id = ${report.runId}`.execute(
      this.db,
    );
    throw rows.length === 0
      ? new NotFoundError('Import run', report.runId)
      : new ConflictError(`Import run ${report.runId} already finished.`);
  }
}
