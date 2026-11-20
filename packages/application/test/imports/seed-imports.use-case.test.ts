import { SeedImportsUseCase } from '@amexbutikker/application';
import { ImportRunIdSchema } from '@amexbutikker/contracts';
import type {
  ImportRunReader,
  ImportRunReport,
  ImportSource,
  RunImport,
  RunImportInput,
} from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';

const T0 = new Date('2026-11-20T08:00:00.000Z');

class FixedRuns implements ImportRunReader {
  public constructor(private readonly succeeded: readonly ImportSource[]) {}

  public findLastSucceededAt(source: ImportSource): Promise<Date | null> {
    return Promise.resolve(this.succeeded.includes(source) ? T0 : null);
  }
}

class RecordingRunImport implements RunImport {
  public readonly inputs: RunImportInput[] = [];

  public constructor(private readonly failing: ImportSource | null = null) {}

  public execute(input: RunImportInput): Promise<ImportRunReport> {
    this.inputs.push(input);
    return Promise.resolve({
      runId: ImportRunIdSchema.parse('0190a000-0000-7000-8000-000000000001'),
      source: input.source,
      dryRun: input.dryRun,
      status: input.source === this.failing ? 'failed' : 'succeeded',
      startedAt: T0,
      finishedAt: T0,
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
      messages: [],
    });
  }
}

const ALL: readonly ImportSource[] = ['osm_overpass', 'brreg_underenheter', 'curated_list'];

describe('SeedImportsUseCase', () => {
  it('runs, in order, each source that never imported, and skips the rest', async () => {
    const runImport = new RecordingRunImport();
    const output = await new SeedImportsUseCase(
      new FixedRuns(['brreg_underenheter']),
      runImport,
    ).execute({ sources: ALL });

    expect(runImport.inputs).toEqual([
      { source: 'osm_overpass', dryRun: false },
      { source: 'curated_list', dryRun: false },
    ]);
    expect(output.skipped).toEqual(['brreg_underenheter']);
    expect(output.pending).toEqual([]);
    expect(output.reports.map((report) => report.status)).toEqual(['succeeded', 'succeeded']);
  });

  it('stops at a failed source, leaving the later ones for the next seed', async () => {
    const runImport = new RecordingRunImport('osm_overpass');
    const output = await new SeedImportsUseCase(new FixedRuns([]), runImport).execute({
      sources: ALL,
    });

    expect(runImport.inputs).toEqual([{ source: 'osm_overpass', dryRun: false }]);
    expect(output.pending).toEqual(['brreg_underenheter', 'curated_list']);
    expect(output.reports.map((report) => report.status)).toEqual(['failed']);
  });
});
