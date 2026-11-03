import { RunImportUseCase } from '@amexbutikker/application';
import type { ImportContext, ImportRunReport, SourceImporter } from '@amexbutikker/contracts';
import { NotFoundError } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import { describe, expect, it } from 'vitest';
import { EmptyInMemoryTablesFactory, InMemoryImportRunRepository } from '@amexbutikker/in-memory';

const clock = { now: () => new Date('2026-11-03T12:00:00Z') };

class FakeImporter implements SourceImporter {
  public readonly source = 'curated_list' as const;

  public constructor(private readonly failure: 'none' | 'error' | 'non-error') {}

  public run(context: ImportContext): Promise<ImportRunReport> {
    if (this.failure === 'error') {
      return Promise.reject(new Error('file missing'));
    }
    if (this.failure === 'non-error') {
      // Simulates a third-party importer that rejects with a plain value.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return Promise.reject('file missing');
    }
    return Promise.resolve({
      runId: context.runId,
      source: this.source,
      dryRun: context.dryRun,
      status: 'succeeded',
      startedAt: context.startedAt,
      finishedAt: clock.now(),
      fetchedAt: null,
      counts: {
        read: 3,
        created: 0,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        failed: 0,
        evidenceAppended: 3,
      },
      metrics: {},
      messages: [],
    });
  }
}

describe('RunImportUseCase', () => {
  function setup(failure: 'none' | 'error' | 'non-error' = 'none') {
    const tables = new EmptyInMemoryTablesFactory().create();
    const useCase = new RunImportUseCase(
      [new FakeImporter(failure)],
      new InMemoryImportRunRepository(tables),
      new TestData(),
      clock,
    );
    return { tables, useCase };
  }

  it('records the run and its report', async () => {
    const { tables, useCase } = setup();

    const report = await useCase.execute({ source: 'curated_list', dryRun: true });

    expect(report.counts.evidenceAppended).toBe(3);
    expect(tables.importRuns.get(report.runId)?.report).toEqual(report);
  });

  it('records a failed run before rethrowing', async () => {
    const { tables, useCase } = setup('error');

    await expect(useCase.execute({ source: 'curated_list', dryRun: false })).rejects.toThrow(
      'file missing',
    );
    const [run] = [...tables.importRuns.values()];
    expect(run?.report).toMatchObject({ status: 'failed', messages: ['file missing'] });
  });

  it('records a generic message when the importer rejects with a non-error', async () => {
    const { tables, useCase } = setup('non-error');

    await expect(useCase.execute({ source: 'curated_list', dryRun: false })).rejects.toBe(
      'file missing',
    );
    const [run] = [...tables.importRuns.values()];
    expect(run?.report?.messages).toEqual(['Importer threw a non-error value.']);
  });

  it('throws NotFoundError for a source without an importer', async () => {
    await expect(
      setup().useCase.execute({ source: 'osm_overpass', dryRun: false }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
