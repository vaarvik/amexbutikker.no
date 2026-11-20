import type {
  ImportRunReader,
  ImportRunReport,
  ImportSource,
  RunImport,
  SeedImports,
  SeedImportsInput,
  SeedImportsOutput,
} from '@amexbutikker/contracts';

export class SeedImportsUseCase implements SeedImports {
  public constructor(
    private readonly runs: ImportRunReader,
    private readonly runImport: RunImport,
  ) {}

  public async execute(input: SeedImportsInput): Promise<SeedImportsOutput> {
    const reports: ImportRunReport[] = [];
    const skipped: ImportSource[] = [];
    for (const [index, source] of input.sources.entries()) {
      if ((await this.runs.findLastSucceededAt(source)) !== null) {
        skipped.push(source);
        continue;
      }
      // In turn, not in parallel: claims match against the places imported before them.
      const report = await this.runImport.execute({ source, dryRun: false });
      reports.push(report);
      if (report.status === 'failed') {
        return { reports, skipped, pending: input.sources.slice(index + 1) };
      }
    }
    return { reports, skipped, pending: [] };
  }
}
