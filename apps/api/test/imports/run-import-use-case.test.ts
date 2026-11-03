import { RunImportUseCase } from '@amexbutikker/application';
import type { ImportContext, ImportRunReport, SourceImporter } from '@amexbutikker/contracts';
import { NotFoundError } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { InMemoryImportRunRepository } from '../../src/imports/in-memory/in-memory-import-run-repository.js';
import { EmptyInMemoryTablesFactory } from '../../src/shared/in-memory/in-memory-tables.js';
import { UuidV7IdGenerator } from '../../src/shared/infrastructure/uuid-v7-id-generator.js';

const clock = { now: () => new Date('2026-11-03T12:00:00Z') };

class FakeImporter implements SourceImporter {
  public readonly source = 'curated_list' as const;

  public constructor(private readonly fail: boolean) {}

  public run(context: ImportContext): Promise<ImportRunReport> {
    if (this.fail) {
      return Promise.reject(new Error('file missing'));
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
  function setup(fail: boolean) {
    const tables = new EmptyInMemoryTablesFactory().create();
    const useCase = new RunImportUseCase(
      [new FakeImporter(fail)],
      new InMemoryImportRunRepository(tables),
      new UuidV7IdGenerator(clock),
      clock,
    );
    return { tables, useCase };
  }

  it('records the run and its report', async () => {
    const { tables, useCase } = setup(false);

    const report = await useCase.execute({ source: 'curated_list', dryRun: true });

    expect(report.counts.evidenceAppended).toBe(3);
    expect(tables.importRuns.get(report.runId)?.report).toEqual(report);
  });

  it('records a failed run before rethrowing', async () => {
    const { tables, useCase } = setup(true);

    await expect(useCase.execute({ source: 'curated_list', dryRun: false })).rejects.toThrow(
      'file missing',
    );
    const [run] = [...tables.importRuns.values()];
    expect(run?.report).toMatchObject({ status: 'failed', messages: ['file missing'] });
  });

  it('throws NotFoundError for a source without an importer', async () => {
    await expect(
      setup(false).useCase.execute({ source: 'osm_overpass', dryRun: false }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
