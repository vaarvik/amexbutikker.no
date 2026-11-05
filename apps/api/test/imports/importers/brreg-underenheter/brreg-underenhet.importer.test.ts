import type {
  ImportContext,
  ImportRunId,
  PhysicalPlace,
  TransactionalPorts,
} from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import { TrigramNameSimilarity } from '@amexbutikker/domain';
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
import { AddressBrregPlaceMatcher } from '../../../../src/imports/importers/brreg-underenheter/address-brreg-place.matcher.js';
import { BrregUnderenhetImporter } from '../../../../src/imports/importers/brreg-underenheter/brreg-underenhet.importer.js';
import type {
  BrregUnderenhetFile,
  BrregUnderenhetReader,
} from '../../../../src/imports/importers/brreg-underenheter/brreg-underenheter.ports.js';
import { TransactionalImportUnitOfWork } from '../../../../src/imports/transactional-import.unit-of-work.js';

const now = new Date('2026-11-04T08:00:00Z');
const fetchedAt = new Date('2026-11-04T04:30:00Z');
const clock = { now: () => now };
const names = new TrigramNameSimilarity();

function row(overrides: Record<string, string>): Record<string, string> {
  return {
    organisasjonsnummer: '912345678',
    navn: 'REMA 1000 GRØNLAND AS',
    'naeringskode1.kode': '47.111',
    'beliggenhetsadresse.adresse': 'Grønlandsleiret 9',
    'beliggenhetsadresse.postnummer': '0190',
    'beliggenhetsadresse.kommunenummer': '0301',
    nedleggelsesdato: '',
    ...overrides,
  };
}

class StubBrregUnderenhetReader implements BrregUnderenhetReader {
  public constructor(public rows: Record<string, string>[] | Error) {}

  public getFile(): Promise<BrregUnderenhetFile> {
    if (this.rows instanceof Error) {
      return Promise.reject(this.rows);
    }
    const rows = this.rows;
    return Promise.resolve({
      fetchedAt,
      rows: (async function* () {
        await Promise.resolve();
        yield* rows;
      })(),
    });
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
  return { runId: '0190a000-0000-7000-8000-000000000003' as ImportRunId, startedAt: now, dryRun };
}

describe('BrregUnderenhetImporter', () => {
  const data = new TestData();
  const at = (street: string, postcode = '0190') => ({ street, postcode, city: 'Oslo' });
  const rema = data.physicalPlace({ name: 'Rema 1000 Grønland', address: at('Grønlandsleiret 9') });
  const kafe = data.physicalPlace({ name: 'Kafé Åsen', address: at('Torggata 1', '0181') });
  const taken = data.physicalPlace({
    name: 'Bar Boca',
    address: at('Thorvald Meyers gate 30', '0555'),
    brregOrgnr: '999999999',
  });
  let tables: InMemoryTables;
  let reader: StubBrregUnderenhetReader;
  let importer: BrregUnderenhetImporter;

  beforeEach(async () => {
    tables = new EmptyInMemoryTablesFactory().create();
    for (const place of [rema, kafe, taken]) {
      await portsFor(tables).places.create(place);
    }
    reader = new StubBrregUnderenhetReader([
      row({}),
      row({
        organisasjonsnummer: '912345679',
        navn: 'KAFE ASEN AS',
        'naeringskode1.kode': '56.101',
        'beliggenhetsadresse.adresse': 'Torggata 1',
        'beliggenhetsadresse.postnummer': '0181',
      }),
      row({
        organisasjonsnummer: '912345680',
        navn: 'BAR BOCA AS',
        'naeringskode1.kode': '56.301',
        'beliggenhetsadresse.adresse': 'Thorvald Meyers gate 30',
        'beliggenhetsadresse.postnummer': '0555',
      }),
      row({
        organisasjonsnummer: '912345681',
        navn: 'NOWHERE AS',
        'beliggenhetsadresse.adresse': 'Ingen vei 1',
      }),
      row({ organisasjonsnummer: '912345682', 'beliggenhetsadresse.postnummer': '' }),
      row({ organisasjonsnummer: '12', navn: 'BROKEN' }),
      row({ organisasjonsnummer: '912345683', 'beliggenhetsadresse.kommunenummer': '3301' }),
      row({ organisasjonsnummer: '912345684', 'naeringskode1.kode': '62.010' }),
      row({ organisasjonsnummer: '912345685', nedleggelsesdato: '2025-01-01' }),
      row({
        organisasjonsnummer: '912345686',
        navn: 'HOTELL AS',
        'naeringskode1.kode': '55.101',
        'beliggenhetsadresse.adresse': 'Ingen vei 2',
      }),
    ]);
    importer = new BrregUnderenhetImporter(
      reader,
      new AddressBrregPlaceMatcher(names, { minimumScore: 0.3, minimumLead: 0.05 }),
      new TransactionalImportUnitOfWork(new InMemoryUnitOfWork(tables, portsFor)),
      clock,
      { kommunenummer: '0301', maxMessages: 20 },
    );
  });

  function orgnr(place: PhysicalPlace): string | null {
    const stored = tables.places.get(place.id);
    return stored?.kind === 'physical' ? stored.brregOrgnr : null;
  }

  it('attaches orgnrs to matching places and reports the match rate', async () => {
    const report = await importer.run(context());

    expect(report).toMatchObject({
      source: 'brreg_underenheter',
      status: 'succeeded',
      fetchedAt,
      counts: {
        read: 7,
        created: 0,
        updated: 2,
        unchanged: 0,
        skipped: 4,
        failed: 1,
        evidenceAppended: 0,
      },
      metrics: { rowsScanned: 10, matched: 2, matchRate: 2 / 7 },
    });
    expect(orgnr(rema)).toBe('912345678');
    expect(orgnr(kafe)).toBe('912345679');
    expect(orgnr(taken)).toBe('999999999');
    expect(report.messages).toEqual([
      '912345682 REMA 1000 GRØNLAND AS: has no postcode',
      expect.stringMatching(/^row 6 is invalid: /),
      '912345681 NOWHERE AS: no place at Ingen vei 1, 0190',
      '912345686 HOTELL AS: no place at Ingen vei 2, 0190',
      '912345680 BAR BOCA AS: Bar Boca already has orgnr 999999999',
    ]);
  });

  it('is idempotent: a second run only reports unchanged places', async () => {
    await importer.run(context());

    const report = await importer.run(context());

    expect(report.counts).toMatchObject({ updated: 0, unchanged: 2 });
    expect(report.metrics).toMatchObject({ matched: 2 });
  });

  it('gives a place to the first unit that matches it', async () => {
    reader.rows = [row({}), row({ organisasjonsnummer: '912345699' })];

    const report = await importer.run(context());

    expect(report.counts).toMatchObject({ updated: 1, skipped: 1 });
    expect(report.messages).toEqual([
      '912345699 REMA 1000 GRØNLAND AS: Rema 1000 Grønland already has orgnr 912345678',
    ]);
  });

  it('writes nothing in a dry run', async () => {
    const report = await importer.run(context(true));

    expect(report.counts).toMatchObject({ updated: 2 });
    expect(orgnr(rema)).toBeNull();
  });

  it('reports a failed download and a zero match rate for an empty scope', async () => {
    reader.rows = new Error('Brønnøysund answered 503');
    await expect(importer.run(context())).resolves.toMatchObject({
      status: 'failed',
      fetchedAt: null,
      metrics: { rowsScanned: 0 },
      messages: ['Brønnøysund answered 503'],
    });

    reader.rows = [];
    await expect(importer.run(context())).resolves.toMatchObject({ metrics: { matchRate: 0 } });
  });

  it('rethrows an abort', async () => {
    const controller = new AbortController();
    controller.abort(new Error('stopped'));

    await expect(importer.run({ ...context(), signal: controller.signal })).rejects.toThrow(
      'stopped',
    );
  });
});
