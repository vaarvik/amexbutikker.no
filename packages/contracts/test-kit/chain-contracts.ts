import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../src/index.js';
import type { ChainReader, ChainWriter } from '../src/index.js';
import { FixtureHolder } from './fixture.js';
import type { FixtureFactory } from './fixture.js';
import { TestData, daysAfter, T0 } from './test-data.js';

export interface ChainReaderFixture {
  readonly reader: ChainReader;
  /** Used only to arrange data. */
  readonly writer: ChainWriter;
}

/** Behaviour every ChainReader must have. */
export function describeChainReaderContract(
  name: string,
  factory: FixtureFactory<ChainReaderFixture>,
): void {
  describe(`${name} satisfies ChainReader`, () => {
    const fixture = new FixtureHolder(factory);

    it('getById returns the chain exactly as created', async () => {
      const chain = new TestData().chain({ brandWikidata: null });
      await fixture.current.writer.create(chain);

      await expect(fixture.current.reader.getById(chain.id)).resolves.toEqual(chain);
    });

    it('getById throws NotFoundError for an unknown id', async () => {
      await expect(fixture.current.reader.getById(new TestData().chainId())).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('findByName matches ignoring case, accents and surrounding whitespace', async () => {
      const chain = new TestData().chain({ name: 'Kaffebrenneriet Ålesund' });
      await fixture.current.writer.create(chain);

      await expect(
        fixture.current.reader.findByName('  kaffebrenneriet alesund '),
      ).resolves.toEqual(chain);
    });

    it('findByName returns null for partial or unknown names', async () => {
      await fixture.current.writer.create(new TestData().chain({ name: 'Narvesen' }));

      await expect(fixture.current.reader.findByName('Narve')).resolves.toBeNull();
      await expect(fixture.current.reader.findByName('Ukjent')).resolves.toBeNull();
    });

    it('findByName returns the oldest of several matches', async () => {
      const data = new TestData();
      const older = data.chain({ name: 'Deli de Luca', brandWikidata: null, createdAt: T0 });
      const newer = data.chain({
        name: 'Deli de Luca',
        brandWikidata: null,
        createdAt: daysAfter(T0, 1),
      });
      await fixture.current.writer.create(newer);
      await fixture.current.writer.create(older);

      await expect(fixture.current.reader.findByName('Deli de Luca')).resolves.toEqual(older);
    });

    it('getHint returns null before a hint is saved, also for unknown chains', async () => {
      const chain = new TestData().chain();
      await fixture.current.writer.create(chain);

      await expect(fixture.current.reader.getHint(chain.id)).resolves.toBeNull();
      await expect(fixture.current.reader.getHint(new TestData().chainId())).resolves.toBeNull();
    });
  });
}

export interface ChainWriterFixture {
  readonly writer: ChainWriter;
  /** Used only to assert. */
  readonly reader: ChainReader;
}

/** Behaviour every ChainWriter must have. */
export function describeChainWriterContract(
  name: string,
  factory: FixtureFactory<ChainWriterFixture>,
): void {
  describe(`${name} satisfies ChainWriter`, () => {
    const fixture = new FixtureHolder(factory);

    it('create throws ConflictError for an existing id', async () => {
      const data = new TestData();
      const chain = data.chain();
      await fixture.current.writer.create(chain);

      await expect(
        fixture.current.writer.create(data.chain({ id: chain.id })),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('create throws ConflictError for a brandWikidata that is already taken', async () => {
      const data = new TestData();
      await fixture.current.writer.create(data.chain({ brandWikidata: 'Q123' }));

      await expect(
        fixture.current.writer.create(data.chain({ brandWikidata: 'Q123' })),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('upsertFromSource is idempotent on brandWikidata and updates the name', async () => {
      const data = new TestData();
      const newId = data.chainId();

      const first = await fixture.current.writer.upsertFromSource(
        { name: 'Rema 1000', brandWikidata: 'Q28459' },
        newId,
      );
      const again = await fixture.current.writer.upsertFromSource(
        { name: 'Rema 1000', brandWikidata: 'Q28459' },
        data.chainId(),
      );
      const renamed = await fixture.current.writer.upsertFromSource(
        { name: 'REMA 1000', brandWikidata: 'Q28459' },
        data.chainId(),
      );

      expect(first).toEqual({ chainId: newId, outcome: 'created' });
      expect(again).toEqual({ chainId: newId, outcome: 'unchanged' });
      expect(renamed).toEqual({ chainId: newId, outcome: 'updated' });
      await expect(fixture.current.reader.getById(newId)).resolves.toMatchObject({
        name: 'REMA 1000',
      });
    });

    it('upsertFromSource is keyed by name when brandWikidata is null', async () => {
      const data = new TestData();
      const newId = data.chainId();

      await fixture.current.writer.upsertFromSource(
        { name: 'Lokalbutikken', brandWikidata: null },
        newId,
      );
      const again = await fixture.current.writer.upsertFromSource(
        { name: 'Lokalbutikken', brandWikidata: null },
        data.chainId(),
      );

      expect(again).toEqual({ chainId: newId, outcome: 'unchanged' });
    });

    it('saveHint stores the hint and replaces an earlier one', async () => {
      const data = new TestData();
      const chain = data.chain();
      await fixture.current.writer.create(chain);
      const first = data.chainHint(chain.id, { acceptedCount: 1, totalWithEvidence: 2 });
      const second = data.chainHint(chain.id, {
        acceptedCount: 7,
        totalWithEvidence: 9,
        calculatedAt: daysAfter(T0, 1),
      });

      await fixture.current.writer.saveHint(first);
      await fixture.current.writer.saveHint(second);

      await expect(fixture.current.reader.getHint(chain.id)).resolves.toEqual(second);
    });

    it('saveHint throws NotFoundError for an unknown chain', async () => {
      const data = new TestData();

      await expect(
        fixture.current.writer.saveHint(data.chainHint(data.chainId())),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
}
