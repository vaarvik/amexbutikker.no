import { CalculatingPlaceStatusRefresher } from '@amexbutikker/application';
import type { ImportContext, ImportRunId, TransactionalPorts } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import {
  DecayingAcceptanceStatusCalculator,
  DefaultEvidenceWeightPolicy,
  ProportionChainHintCalculator,
  SupersedingEvidenceSelector,
  TrigramNameSimilarity,
} from '@amexbutikker/domain';
import {
  EmptyInMemoryTablesFactory,
  InMemoryChainRepository,
  InMemoryEvidenceRepository,
  InMemoryPlaceRepository,
  InMemoryPlaceStatusRepository,
  InMemoryUnitOfWork,
} from '@amexbutikker/in-memory';
import type { InMemoryTables } from '@amexbutikker/in-memory';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TextFileLoader } from '../../../../src/imports/imports.ports.js';
import { CuratedListImporter } from '../../../../src/imports/importers/curated-list/curated-list.importer.js';
import { TransactionalImportUnitOfWork } from '../../../../src/imports/transactional-import.unit-of-work.js';
import { UuidV7IdGenerator } from '../../../../src/shared/uuid-v7-id.generator.js';

const now = new Date('2026-11-04T08:00:00Z');
const clock = { now: () => now };
const names = new TrigramNameSimilarity();
const PATH = 'data/curated-claims.yaml';

class StubTextFileLoader implements TextFileLoader {
  public loaded: string[] = [];

  public constructor(public text: string | Error) {}

  public load(path: string): Promise<string> {
    this.loaded.push(path);
    return this.text instanceof Error ? Promise.reject(this.text) : Promise.resolve(this.text);
  }
}

function portsFor(tables: InMemoryTables): TransactionalPorts {
  return {
    places: new InMemoryPlaceRepository(tables, names, clock),
    chains: new InMemoryChainRepository(tables, names, clock),
    evidence: new InMemoryEvidenceRepository(tables),
    statuses: new InMemoryPlaceStatusRepository(tables),
  };
}

function context(dryRun = false): ImportContext {
  return { runId: '0190a000-0000-7000-8000-000000000002' as ImportRunId, startedAt: now, dryRun };
}

const claims = `
claims:
  - target: chain
    name: rema 1000
    result: accepted
    source: kredittkort360
    sourceUrl: https://example.no/amex-butikker
    fetchedAt: 2026-10-01
  - target: place
    name: Kafé Åsen
    result: rejected
    source: kredittkort360
    sourceUrl: https://example.no/amex-butikker
    fetchedAt: 2026-10-02T10:00:00+02:00
    note: Bare Visa og Mastercard
  - target: place
    name: Pizza Napoli
    result: accepted
    source: kredittkort360
    sourceUrl: https://example.no/amex-butikker
    fetchedAt: 2026-10-01
  - target: chain
    name: Ukjent Kjede
    result: accepted
    source: kredittkort360
    sourceUrl: https://example.no/amex-butikker
    fetchedAt: 2026-10-01
  - target: shop
    name: Feil
`;

describe('CuratedListImporter', () => {
  let tables: InMemoryTables;
  let loader: StubTextFileLoader;
  let importer: CuratedListImporter;
  const data = new TestData();
  const chain = data.chain({ name: 'Rema 1000' });
  const remaA = data.physicalPlace({ name: 'Rema 1000 Grønland', chainId: chain.id });
  const remaB = data.physicalPlace({ name: 'Rema 1000 Tøyen', chainId: chain.id });
  const kafe = data.physicalPlace({ name: 'Kafe Asen' });

  beforeEach(async () => {
    tables = new EmptyInMemoryTablesFactory().create();
    const ports = portsFor(tables);
    await ports.chains.create(chain);
    for (const place of [
      remaA,
      remaB,
      kafe,
      data.physicalPlace({ name: 'Pizza Napoli' }),
      data.physicalPlace({ name: 'Pizza Napoli' }),
    ]) {
      await ports.places.create(place);
    }
    loader = new StubTextFileLoader(claims);
    const selector = new SupersedingEvidenceSelector();
    importer = new CuratedListImporter(
      loader,
      new TransactionalImportUnitOfWork(new InMemoryUnitOfWork(tables, portsFor)),
      new CalculatingPlaceStatusRefresher(
        new DecayingAcceptanceStatusCalculator(new DefaultEvidenceWeightPolicy(), {}, selector),
        new ProportionChainHintCalculator(),
        clock,
      ),
      names,
      new UuidV7IdGenerator(clock),
      clock,
      { path: PATH, maxMessages: 20 },
    );
  });

  it('appends chain_confirmation for chains and external_list for places, and refreshes their statuses', async () => {
    const report = await importer.run(context());

    expect(loader.loaded).toEqual([PATH]);
    expect(report).toMatchObject({
      source: 'curated_list',
      status: 'succeeded',
      fetchedAt: new Date('2026-10-02T08:00:00Z'),
      counts: {
        read: 5,
        created: 0,
        updated: 0,
        unchanged: 0,
        skipped: 2,
        failed: 1,
        evidenceAppended: 2,
      },
      metrics: { placesRefreshed: 3 },
    });
    expect(report.messages).toEqual([
      expect.stringMatching(/^claim 4 is invalid: ✖ Invalid option: .*→ at target/),
      'claim 2: 2 places are named "Pizza Napoli"; skipped as ambiguous',
      'claim 3: no chain named "Ukjent Kjede"',
    ]);
    const evidence = [...tables.evidence.values()];
    expect(evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: { type: 'chain', chainId: chain.id },
          kind: 'chain_confirmation',
          result: 'accepted',
          source: 'kredittkort360',
          sourceRef: 'https://example.no/amex-butikker#chain:rema 1000@2026-10-01T00:00:00.000Z',
          observedAt: new Date('2026-10-01T00:00:00Z'),
          importedAt: now,
          userId: null,
          note: null,
        }),
        expect.objectContaining({
          target: { type: 'place', placeId: kafe.id },
          kind: 'external_list',
          result: 'rejected',
          note: 'Bare Visa og Mastercard',
        }),
      ]),
    );
    expect(tables.statuses.get(remaA.id)?.status.status).toBe('accepted');
    expect(tables.statuses.get(remaB.id)?.status.status).toBe('accepted');
    expect(tables.statuses.get(kafe.id)?.status.status).toBe('rejected');
  });

  it('is idempotent: a second run appends nothing', async () => {
    await importer.run(context());

    const report = await importer.run(context());

    expect(report.counts).toMatchObject({ evidenceAppended: 0, unchanged: 2 });
    expect(report.metrics).toEqual({ placesRefreshed: 0 });
    expect(tables.evidence.size).toBe(2);
  });

  it('writes nothing in a dry run', async () => {
    const report = await importer.run(context(true));

    expect(report).toMatchObject({ dryRun: true, counts: { evidenceAppended: 2 } });
    expect(tables.evidence.size).toBe(0);
    expect(tables.statuses.size).toBe(0);
  });

  it('accepts an empty claim list', async () => {
    loader.text = 'claims:\n';

    await expect(importer.run(context())).resolves.toMatchObject({
      status: 'succeeded',
      fetchedAt: null,
      counts: { read: 0 },
    });
  });

  it.each([
    [
      'an unreadable file',
      new Error('ENOENT: no such file'),
      /^Cannot read data\/curated-claims\.yaml: ENOENT/,
    ],
    ['invalid YAML', 'claims: [', /^data\/curated-claims\.yaml is not valid YAML: /],
    ['a file without claims', 'other: 1', /^data\/curated-claims\.yaml has no claims list: /],
  ])('reports %s as a failed run', async (_, text, message) => {
    loader.text = text;

    const report = await importer.run(context());

    expect(report).toMatchObject({ status: 'failed', counts: { read: 0 } });
    expect(report.messages).toEqual([expect.stringMatching(message)]);
  });

  it('rethrows an abort', async () => {
    const controller = new AbortController();
    controller.abort(new Error('stopped'));

    await expect(importer.run({ ...context(), signal: controller.signal })).rejects.toThrow(
      'stopped',
    );
  });
});
