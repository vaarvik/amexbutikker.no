import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../src/index.js';
import type {
  ImportRunId,
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
