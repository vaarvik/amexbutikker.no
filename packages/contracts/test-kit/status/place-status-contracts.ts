import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../../src/index.js';
import type {
  ChainWriter,
  PlaceStatusReader,
  PlaceStatusWriter,
  PlaceWriter,
} from '../../src/index.js';
import { FixtureHolder } from '../fixture.js';
import type { FixtureFactory } from '../fixture.js';
import { TestData, daysAfter, T0 } from '../test-data.js';

export interface PlaceStatusFixture {
  readonly reader: PlaceStatusReader;
  readonly writer: PlaceStatusWriter;
  /** Used only to arrange places. */
  readonly places: PlaceWriter;
  readonly chains: ChainWriter;
}

/** Behaviour every PlaceStatusReader / PlaceStatusWriter pair must have. */
export function describePlaceStatusContract(
  name: string,
  factory: FixtureFactory<PlaceStatusFixture>,
): void {
  describe(`${name} satisfies PlaceStatusReader and PlaceStatusWriter`, () => {
    const fixture = new FixtureHolder(factory);

    it('get returns null before anything is saved', async () => {
      const place = new TestData().physicalPlace();
      await fixture.current.places.create(place);

      await expect(fixture.current.reader.get(place.id)).resolves.toBeNull();
    });

    it('save stores the snapshot exactly and replaces an earlier one', async () => {
      const data = new TestData();
      const place = data.physicalPlace();
      await fixture.current.places.create(place);
      const first = data.statusSnapshot(place.id);
      const second = data.statusSnapshot(place.id, {
        status: {
          status: 'mixed',
          confidence: 0.55,
          basis: 'transaction',
          verified: true,
          lastEvidenceAt: daysAfter(T0, 3),
        },
        calculatedAt: daysAfter(T0, 3),
      });

      await fixture.current.writer.save(first);
      await fixture.current.writer.save(second);

      await expect(fixture.current.reader.get(place.id)).resolves.toEqual(second);
    });

    it('stores an unknown status with null basis and lastEvidenceAt', async () => {
      const data = new TestData();
      const place = data.onlinePlace();
      await fixture.current.places.create(place);
      const snapshot = data.statusSnapshot(place.id, {
        status: {
          status: 'unknown',
          confidence: 0,
          basis: null,
          verified: false,
          lastEvidenceAt: null,
        },
      });

      await fixture.current.writer.save(snapshot);

      await expect(fixture.current.reader.get(place.id)).resolves.toEqual(snapshot);
    });

    it('getMany returns only places that have a snapshot', async () => {
      const data = new TestData();
      const withStatus = data.physicalPlace();
      const without = data.physicalPlace();
      await fixture.current.places.create(withStatus);
      await fixture.current.places.create(without);
      const snapshot = data.statusSnapshot(withStatus.id);
      await fixture.current.writer.save(snapshot);

      const found = await fixture.current.reader.getMany([
        withStatus.id,
        without.id,
        data.placeId(),
      ]);

      expect([...found.entries()]).toEqual([[withStatus.id, snapshot]]);
    });

    it('getMany of nothing is an empty map', async () => {
      await expect(fixture.current.reader.getMany([])).resolves.toEqual(new Map());
    });

    it('listForChain returns snapshots of that chain only', async () => {
      const data = new TestData();
      const chain = data.chain();
      const otherChain = data.chain();
      await fixture.current.chains.create(chain);
      await fixture.current.chains.create(otherChain);
      const a = data.physicalPlace({ chainId: chain.id });
      const b = data.physicalPlace({ chainId: chain.id });
      const other = data.physicalPlace({ chainId: otherChain.id });
      for (const place of [a, b, other]) {
        await fixture.current.places.create(place);
        await fixture.current.writer.save(data.statusSnapshot(place.id));
      }

      const listed = await fixture.current.reader.listForChain(chain.id);

      expect(listed.map((snapshot) => snapshot.placeId).sort()).toEqual([a.id, b.id].sort());
    });

    it('save throws NotFoundError for an unknown place', async () => {
      const data = new TestData();

      await expect(
        fixture.current.writer.save(data.statusSnapshot(data.placeId())),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
}
