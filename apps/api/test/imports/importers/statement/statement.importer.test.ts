import type { ImportContext, ImportRunId, PlaceId } from '@amexbutikker/contracts';
import {
  EmptyInMemoryTablesFactory,
  InMemoryUnmatchedDescriptorRepository,
} from '@amexbutikker/in-memory';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TextFileLoader } from '../../../../src/imports/imports.ports.js';
import { NullMerchantDescriptorMatcher } from '../../../../src/imports/importers/statement/null-merchant-descriptor.matcher.js';
import { StatementImporter } from '../../../../src/imports/importers/statement/statement.importer.js';
import type { StatementLine } from '../../../../src/imports/importers/statement/statement.model.js';
import type {
  MerchantDescriptorMatcher,
  StatementParser,
} from '../../../../src/imports/importers/statement/statement.ports.js';
import { UnconfiguredStatementParser } from '../../../../src/imports/importers/statement/unconfigured-statement.parser.js';

const now = new Date('2026-11-04T08:00:00Z');
const clock = { now: () => now };
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

class StubTextFileLoader implements TextFileLoader {
  public load(): Promise<string> {
    return Promise.resolve('statement text');
  }
}

class LinesStatementParser implements StatementParser {
  public constructor(private readonly lines: StatementLine[]) {}

  public parse(): StatementLine[] {
    return this.lines;
  }
}

class KnownMerchantDescriptorMatcher implements MerchantDescriptorMatcher {
  public match(descriptor: string): Promise<PlaceId | null> {
    return Promise.resolve(descriptor.startsWith('KNOWN') ? ('p1' as PlaceId) : null);
  }
}

function context(dryRun = false): ImportContext {
  return { runId: '0190a000-0000-7000-8000-000000000004' as ImportRunId, startedAt: now, dryRun };
}

describe('StatementImporter', () => {
  let review: InMemoryUnmatchedDescriptorRepository;
  const lines: StatementLine[] = [
    { postedOn: day('2026-10-01'), descriptor: 'REMA 1000 GRONLAND OSLO' },
    { postedOn: day('2026-10-03'), descriptor: 'rema 1000 gronland oslo' },
    { postedOn: day('2026-10-02'), descriptor: 'KNOWN SHOP' },
    { postedOn: day('2026-10-02'), descriptor: 'KIWI 123' },
  ];

  beforeEach(() => {
    review = new InMemoryUnmatchedDescriptorRepository(new EmptyInMemoryTablesFactory().create());
  });

  function importer(
    parser: StatementParser,
    matcher: MerchantDescriptorMatcher,
  ): StatementImporter {
    return new StatementImporter(new StubTextFileLoader(), parser, matcher, review, clock, {
      path: 'data/statements/statement.txt',
    });
  }

  it('sends unmatched descriptors to review and only counts matched lines', async () => {
    const report = await importer(
      new LinesStatementParser(lines),
      new KnownMerchantDescriptorMatcher(),
    ).run(context());

    expect(report).toMatchObject({
      source: 'statement',
      status: 'succeeded',
      fetchedAt: null,
      counts: { read: 4, created: 2, updated: 1, unchanged: 0, skipped: 1, evidenceAppended: 0 },
      metrics: { matched: 1 },
      messages: [
        '1 matched lines were not turned into evidence: transaction evidence needs the paying user.',
      ],
    });
    await expect(review.list()).resolves.toEqual([
      {
        descriptor: 'REMA 1000 GRONLAND OSLO',
        firstSeenOn: day('2026-10-01'),
        lastSeenOn: day('2026-10-03'),
      },
      { descriptor: 'KIWI 123', firstSeenOn: day('2026-10-02'), lastSeenOn: day('2026-10-02') },
    ]);
  });

  it('writes nothing to review in a dry run', async () => {
    const report = await importer(
      new LinesStatementParser(lines),
      new NullMerchantDescriptorMatcher(),
    ).run(context(true));

    expect(report.counts).toMatchObject({ read: 4, created: 4, skipped: 0 });
    expect(report.messages).toEqual([]);
    await expect(review.list()).resolves.toEqual([]);
  });

  it('fails clearly until a statement format is configured', async () => {
    await expect(
      importer(new UnconfiguredStatementParser(), new NullMerchantDescriptorMatcher()).run(
        context(),
      ),
    ).resolves.toMatchObject({
      status: 'failed',
      messages: ['No statement format is configured yet. Add a StatementParser for the export.'],
    });
  });

  it('rethrows an abort', async () => {
    const controller = new AbortController();
    controller.abort(new Error('stopped'));

    await expect(
      importer(new LinesStatementParser(lines), new NullMerchantDescriptorMatcher()).run({
        ...context(),
        signal: controller.signal,
      }),
    ).rejects.toThrow('stopped');
  });
});
