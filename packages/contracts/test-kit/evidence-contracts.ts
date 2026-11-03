import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../src/index.js';
import type { ChainWriter, EvidenceReader, EvidenceWriter, PlaceWriter } from '../src/index.js';
import { FixtureHolder } from './fixture.js';
import type { FixtureFactory } from './fixture.js';
import { TestData, daysAfter, T0 } from './test-data.js';

export interface EvidenceFixture {
  readonly reader: EvidenceReader;
  readonly writer: EvidenceWriter;
  /** Used only to arrange targets. */
  readonly places: PlaceWriter;
  readonly chains: ChainWriter;
}

/** Behaviour every EvidenceReader / EvidenceWriter pair must have. */
export function describeEvidenceContract(
  name: string,
  factory: FixtureFactory<EvidenceFixture>,
): void {
  describe(`${name} satisfies EvidenceReader and EvidenceWriter`, () => {
    const fixture = new FixtureHolder(factory);

    async function arrange(data: TestData) {
      const chain = data.chain();
      await fixture.current.chains.create(chain);
      const place = data.physicalPlace({ chainId: chain.id });
      await fixture.current.places.create(place);
      return { chain, place };
    }

    it('append stores evidence that listForPlace returns exactly', async () => {
      const data = new TestData();
      const { place } = await arrange(data);
      const evidence = data.evidence({
        target: { type: 'place', placeId: place.id },
        note: 'Gikk fint i kassa',
      });

      await expect(fixture.current.writer.append(evidence)).resolves.toBe('appended');
      await expect(fixture.current.reader.listForPlace(place.id)).resolves.toEqual([evidence]);
    });

    it('stores imported evidence without a user', async () => {
      const data = new TestData();
      const { place } = await arrange(data);
      const evidence = data.evidence({
        target: { type: 'place', placeId: place.id },
        kind: 'external_list',
        source: 'kredittkort360',
        sourceRef: 'claim-1',
        userId: null,
      });

      await fixture.current.writer.append(evidence);

      await expect(fixture.current.reader.listForPlace(place.id)).resolves.toEqual([evidence]);
    });

    it('listForPlace orders newest observedAt first, including withdrawn entries', async () => {
      const data = new TestData();
      const { place } = await arrange(data);
      const target = { type: 'place', placeId: place.id } as const;
      const userId = data.userId();
      const oldest = data.evidence({ target, userId, observedAt: T0 });
      const newest = data.evidence({
        target,
        userId,
        result: 'withdrawn',
        observedAt: daysAfter(T0, 2),
      });
      const middle = data.evidence({ target, result: 'rejected', observedAt: daysAfter(T0, 1) });
      for (const evidence of [middle, oldest, newest]) {
        await fixture.current.writer.append(evidence);
      }

      const listed = await fixture.current.reader.listForPlace(place.id);

      expect(listed.map((evidence) => evidence.id)).toEqual([newest.id, middle.id, oldest.id]);
    });

    it('keeps place and chain evidence apart', async () => {
      const data = new TestData();
      const { chain, place } = await arrange(data);
      const onPlace = data.evidence({ target: { type: 'place', placeId: place.id } });
      const onChain = data.evidence({
        target: { type: 'chain', chainId: chain.id },
        kind: 'chain_confirmation',
        source: 'curated',
        userId: null,
      });
      await fixture.current.writer.append(onPlace);
      await fixture.current.writer.append(onChain);

      await expect(fixture.current.reader.listForPlace(place.id)).resolves.toEqual([onPlace]);
      await expect(fixture.current.reader.listForChain(chain.id)).resolves.toEqual([onChain]);
    });

    it('returns empty lists for unknown targets', async () => {
      const data = new TestData();

      await expect(fixture.current.reader.listForPlace(data.placeId())).resolves.toEqual([]);
      await expect(fixture.current.reader.listForChain(data.chainId())).resolves.toEqual([]);
    });

    it('append is idempotent on (source, sourceRef)', async () => {
      const data = new TestData();
      const { place } = await arrange(data);
      const target = { type: 'place', placeId: place.id } as const;
      const first = data.evidence({
        target,
        source: 'osm',
        sourceRef: 'node/1',
        userId: null,
        kind: 'external_list',
      });
      const duplicate = data.evidence({
        target,
        source: 'osm',
        sourceRef: 'node/1',
        userId: null,
        kind: 'external_list',
        result: 'rejected',
      });

      await fixture.current.writer.append(first);

      await expect(fixture.current.writer.append(duplicate)).resolves.toBe('duplicate');
      await expect(fixture.current.reader.listForPlace(place.id)).resolves.toEqual([first]);
    });

    it('allows the same sourceRef from different sources', async () => {
      const data = new TestData();
      const { place } = await arrange(data);
      const target = { type: 'place', placeId: place.id } as const;

      await fixture.current.writer.append(
        data.evidence({ target, source: 'a', sourceRef: 'x', userId: null }),
      );

      await expect(
        fixture.current.writer.append(
          data.evidence({ target, source: 'b', sourceRef: 'x', userId: null }),
        ),
      ).resolves.toBe('appended');
    });

    it('append throws NotFoundError for an unknown place or chain', async () => {
      const data = new TestData();

      await expect(
        fixture.current.writer.append(
          data.evidence({ target: { type: 'place', placeId: data.placeId() } }),
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        fixture.current.writer.append(
          data.evidence({ target: { type: 'chain', chainId: data.chainId() } }),
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
}
