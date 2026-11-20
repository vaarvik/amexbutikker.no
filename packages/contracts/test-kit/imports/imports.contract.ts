import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../src/index.js';
import type {
  ImportRunId,
  ImportRunReader,
  ImportRunReport,
  ImportRunWriter,
  UnmatchedDescriptorReader,
  UnmatchedDescriptorWriter,
} from '../../src/index.js';
import { FixtureHolder } from '../fixture.js';
import type { FixtureFactory } from '../fixture.js';
import { TestData, daysAfter, T0 } from '../test-data.js';

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

      await fixture.current.writer.create(runId, 'osm_overpass', T0, false);

      await expect(fixture.current.writer.saveReport(report(runId))).resolves.toBeUndefined();
    });

    it('create throws ConflictError for an existing run id', async () => {
      const runId = new TestData().importRunId();
      await fixture.current.writer.create(runId, 'osm_overpass', T0, false);

      await expect(
        fixture.current.writer.create(runId, 'osm_overpass', T0, false),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('saveReport throws NotFoundError for a run that never started', async () => {
      await expect(
        fixture.current.writer.saveReport(report(new TestData().importRunId())),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('saveReport throws ConflictError for a run that already finished', async () => {
      const runId = new TestData().importRunId();
      await fixture.current.writer.create(runId, 'osm_overpass', T0, false);
      await fixture.current.writer.saveReport(report(runId));

      await expect(fixture.current.writer.saveReport(report(runId))).rejects.toBeInstanceOf(
        ConflictError,
      );
    });
  });
}

export interface ImportRunReaderFixture {
  readonly writer: ImportRunWriter;
  readonly reader: ImportRunReader;
}

/** Behaviour every ImportRunReader must have. */
export function describeImportRunReaderContract(
  name: string,
  factory: FixtureFactory<ImportRunReaderFixture>,
): void {
  describe(`${name} satisfies ImportRunReader`, () => {
    const fixture = new FixtureHolder(factory);

    async function run(
      startedAt: Date,
      outcome: {
        status: 'succeeded' | 'failed' | null;
        dryRun?: boolean;
        source?: 'osm_overpass' | 'curated_list';
      },
    ): Promise<void> {
      const runId = new TestData().importRunId();
      const source = outcome.source ?? 'osm_overpass';
      const dryRun = outcome.dryRun ?? false;
      await fixture.current.writer.create(runId, source, startedAt, dryRun);
      if (outcome.status !== null) {
        await fixture.current.writer.saveReport({
          ...report(runId),
          source,
          dryRun,
          status: outcome.status,
          startedAt,
          finishedAt: daysAfter(startedAt, 0.01),
        });
      }
    }

    it('finds nothing for a source that never ran', async () => {
      await expect(fixture.current.reader.findLastSucceededAt('curated_list')).resolves.toBeNull();
    });

    it('ignores failed, unfinished and dry runs, and other sources', async () => {
      await run(T0, { status: 'failed' });
      await run(daysAfter(T0, 1), { status: null });
      await run(daysAfter(T0, 2), { status: 'succeeded', dryRun: true });
      await run(daysAfter(T0, 3), { status: 'succeeded', source: 'curated_list' });

      await expect(fixture.current.reader.findLastSucceededAt('osm_overpass')).resolves.toBeNull();
    });

    it('finds the start of the latest successful run', async () => {
      await run(T0, { status: 'succeeded' });
      await run(daysAfter(T0, 2), { status: 'succeeded' });
      await run(daysAfter(T0, 3), { status: 'failed' });

      await expect(fixture.current.reader.findLastSucceededAt('osm_overpass')).resolves.toEqual(
        daysAfter(T0, 2),
      );
    });
  });
}

export interface UnmatchedDescriptorFixture {
  readonly writer: UnmatchedDescriptorWriter;
  readonly reader: UnmatchedDescriptorReader;
}

/** Behaviour every UnmatchedDescriptorWriter and Reader pair must have. */
export function describeUnmatchedDescriptorContract(
  name: string,
  factory: FixtureFactory<UnmatchedDescriptorFixture>,
): void {
  describe(`${name} satisfies UnmatchedDescriptorWriter and Reader`, () => {
    const fixture = new FixtureHolder(factory);
    const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

    it('records a new descriptor, normalised, with its UTC day', async () => {
      await expect(
        fixture.current.writer.upsert(
          '  Rema 1000   grønland\tOSLO ',
          new Date('2026-10-01T22:30:00Z'),
        ),
      ).resolves.toBe('created');

      await expect(fixture.current.reader.list()).resolves.toEqual([
        {
          descriptor: 'REMA 1000 GRØNLAND OSLO',
          firstSeenOn: day('2026-10-01'),
          lastSeenOn: day('2026-10-01'),
        },
      ]);
    });

    it('widens the seen range and is idempotent within it', async () => {
      const { writer, reader } = fixture.current;
      await writer.upsert('KIWI 123', day('2026-10-05'));

      await expect(writer.upsert('kiwi 123', day('2026-10-01'))).resolves.toBe('updated');
      await expect(writer.upsert('KIWI 123', day('2026-10-09'))).resolves.toBe('updated');
      await expect(writer.upsert('KIWI 123', day('2026-10-05'))).resolves.toBe('unchanged');
      await expect(reader.list()).resolves.toEqual([
        { descriptor: 'KIWI 123', firstSeenOn: day('2026-10-01'), lastSeenOn: day('2026-10-09') },
      ]);
    });

    it('lists the most recently seen first, then by descriptor', async () => {
      const { writer, reader } = fixture.current;
      await writer.upsert('B', day('2026-10-01'));
      await writer.upsert('C', day('2026-10-03'));
      await writer.upsert('A', day('2026-10-01'));

      const listed = await reader.list();

      expect(listed.map((item) => item.descriptor)).toEqual(['C', 'A', 'B']);
    });
  });
}
