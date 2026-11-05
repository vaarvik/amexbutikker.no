import { NotFoundError } from '@amexbutikker/contracts';
import type {
  Clock,
  IdGenerator,
  ImportRunReport,
  ImportRunWriter,
  RunImport,
  RunImportInput,
  SourceImporter,
} from '@amexbutikker/contracts';

export class RunImportUseCase implements RunImport {
  public constructor(
    private readonly importers: readonly SourceImporter[],
    private readonly runs: ImportRunWriter,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(input: RunImportInput): Promise<ImportRunReport> {
    const importer = this.importers.find((candidate) => candidate.source === input.source);
    if (importer === undefined) {
      throw new NotFoundError('Importer', input.source);
    }
    const runId = this.ids.importRunId();
    const startedAt = this.clock.now();
    await this.runs.create(runId, input.source, startedAt, input.dryRun);

    try {
      const report = await importer.run({ runId, startedAt, dryRun: input.dryRun });
      await this.runs.saveReport(report);
      return report;
    } catch (error) {
      await this.runs.saveReport({
        runId,
        source: input.source,
        dryRun: input.dryRun,
        status: 'failed',
        startedAt,
        finishedAt: this.clock.now(),
        fetchedAt: null,
        counts: {
          read: 0,
          created: 0,
          updated: 0,
          unchanged: 0,
          skipped: 0,
          failed: 0,
          evidenceAppended: 0,
        },
        metrics: {},
        messages: [error instanceof Error ? error.message : 'Importer threw a non-error value.'],
      });
      throw error;
    }
  }
}
