import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../src/index.js';
import type { ImportRunId, ImportRunReport, ImportRunWriter } from '../src/index.js';
import { FixtureHolder } from './fixture.js';
import type { FixtureFactory } from './fixture.js';
import { TestData, daysAfter, T0 } from './test-data.js';

export interface ImportRunWriterFixture {
  readonly writer: ImportRunWriter;
}

function report(runId: ImportRunId): ImportRunReport {
  return {
    runId,
    source: 'osm_overpass',
    dryRun: false,
    status: 'succeeded',
    startedAt: T0,
    finishedAt: daysAfter(T0, 0.01),
    fetchedAt: T0,
    counts: {
      read: 10,
      created: 4,
      updated: 1,
      unchanged: 5,
      skipped: 0,
      failed: 0,
      evidenceAppended: 0,
    },
    metrics: { overpassElements: 10 },
    messages: [],
  };
}

/** Behaviour every ImportRunWriter must have. */
export function describeImportRunWriterContract(
  name: string,
  factory: FixtureFactory<ImportRunWriterFixture>,
): void {
  describe(`${name} satisfies ImportRunWriter`, () => {
    const fixture = new FixtureHolder(factory);

    it('records a started run and its report', async () => {
      const runId = new TestData().importRunId();

      await fixture.current.writer.start(runId, 'osm_overpass', T0, false);

      await expect(fixture.current.writer.finish(report(runId))).resolves.toBeUndefined();
    });

    it('start throws ConflictError for an existing run id', async () => {
      const runId = new TestData().importRunId();
      await fixture.current.writer.start(runId, 'osm_overpass', T0, false);

      await expect(
        fixture.current.writer.start(runId, 'osm_overpass', T0, false),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('finish throws NotFoundError for a run that never started', async () => {
      await expect(
        fixture.current.writer.finish(report(new TestData().importRunId())),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('finish throws ConflictError for a run that already finished', async () => {
      const runId = new TestData().importRunId();
      await fixture.current.writer.start(runId, 'osm_overpass', T0, false);
      await fixture.current.writer.finish(report(runId));

      await expect(fixture.current.writer.finish(report(runId))).rejects.toBeInstanceOf(
        ConflictError,
      );
    });
  });
}
