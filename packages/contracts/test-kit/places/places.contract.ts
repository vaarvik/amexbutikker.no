import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../src/index.js';
import type { ChainWriter, PlaceReader, PlaceSourceRecord, PlaceWriter } from '../../src/index.js';
import { FixtureHolder } from '../fixture.js';
import type { FixtureFactory } from '../fixture.js';
import { OSLO_S, TestData, offset } from '../test-data.js';

export interface PlaceReaderFixture {
  readonly reader: PlaceReader;
  /** Used only to arrange data. */
  readonly writer: PlaceWriter;
  readonly chains: ChainWriter;
}

/** Behaviour every PlaceReader must have. */
export function describePlaceReaderContract(
  name: string,
  factory: FixtureFactory<PlaceReaderFixture>,
): void {
  describe(`${name} satisfies PlaceReader`, () => {
    const fixture = new FixtureHolder(factory);

    describe('getById', () => {
      it('returns a physical place exactly as created', async () => {
        const data = new TestData();
        const chain = data.chain();
        await fixture.current.chains.create(chain);
        const place = data.physicalPlace({
          chainId: chain.id,
          website: 'https://kafe.example.no/',
          brregOrgnr: '912345678',
        });
        await fixture.current.writer.create(place);

        await expect(fixture.current.reader.getById(place.id)).resolves.toEqual(place);
      });

      it('returns an online place exactly as created', async () => {
        const place = new TestData().onlinePlace();
        await fixture.current.writer.create(place);

        await expect(fixture.current.reader.getById(place.id)).resolves.toEqual(place);
      });

      it('throws NotFoundError for an unknown id', async () => {
        await expect(
          fixture.current.reader.getById(new TestData().placeId()),
        ).rejects.toBeInstanceOf(NotFoundError);
      });
    });

    describe('search', () => {
      it('matches names ignoring case and accents', async () => {
        const data = new TestData();
        const place = data.physicalPlace({ name: 'Kafé Åsen' });
        await fixture.current.writer.create(place);
        await fixture.current.writer.create(data.physicalPlace({ name: 'Bokhandel' }));

        const hits = await fixture.current.reader.search({ text: 'kafe asen', limit: 10 });

        expect(hits.map((hit) => hit.place.id)).toContain(place.id);
        expect(hits.every((hit) => hit.score >= 0 && hit.score <= 1)).toBe(true);
      });

      it('ranks a closer spelling above a weaker one', async () => {
        const data = new TestData();
        const exact = data.physicalPlace({ name: 'Rema 1000 Grønland' });
        const weaker = data.physicalPlace({ name: 'Remake Studio' });
        await fixture.current.writer.create(weaker);
        await fixture.current.writer.create(exact);

        const hits = await fixture.current.reader.search({ text: 'Rema 1000 Grønland', limit: 10 });

        expect(hits[0]?.place.id).toBe(exact.id);
      });

      it('requires every word of the query to match a word of the name', async () => {
        const data = new TestData();
        const both = data.physicalPlace({ name: 'Rema 1000 Grønland' });
        await fixture.current.writer.create(both);
        await fixture.current.writer.create(data.physicalPlace({ name: 'Kiwi Grønland' }));
        await fixture.current.writer.create(data.physicalPlace({ name: 'Rema 1000 Storo' }));

        const hits = await fixture.current.reader.search({ text: 'rema gronland', limit: 10 });

        expect(hits.map((hit) => hit.place.id)).toEqual([both.id]);
      });

      it('tolerates a typo in a word', async () => {
        const place = new TestData().physicalPlace({ name: 'Rema 1000 Grønland' });
        await fixture.current.writer.create(place);

        const hits = await fixture.current.reader.search({ text: 'rema gronlad', limit: 10 });

        expect(hits.map((hit) => hit.place.id)).toEqual([place.id]);
      });

      it('matches a word inside a longer word', async () => {
        const place = new TestData().physicalPlace({ name: 'Vinmonopolet Bislett' });
        await fixture.current.writer.create(place);

        const hits = await fixture.current.reader.search({ text: 'monopol', limit: 10 });

        expect(hits.map((hit) => hit.place.id)).toEqual([place.id]);
      });

      it('returns an empty list when nothing matches', async () => {
        await fixture.current.writer.create(new TestData().physicalPlace({ name: 'Bakeriet' }));

        await expect(fixture.current.reader.search({ text: 'xqzvwy', limit: 10 })).resolves.toEqual(
          [],
        );
      });

      it('respects limit', async () => {
        const data = new TestData();
        for (let i = 0; i < 4; i += 1) {
          await fixture.current.writer.create(
            data.physicalPlace({ name: `Pizza Napoli ${String(i)}` }),
          );
        }

        const hits = await fixture.current.reader.search({ text: 'Pizza Napoli', limit: 2 });

        expect(hits).toHaveLength(2);
      });

      it('filters by kind', async () => {
        const data = new TestData();
        const online = data.onlinePlace({ name: 'Sportsbutikken' });
        await fixture.current.writer.create(online);
        await fixture.current.writer.create(data.physicalPlace({ name: 'Sportsbutikken' }));

        const hits = await fixture.current.reader.search({
          text: 'Sportsbutikken',
          kind: 'online',
          limit: 10,
        });

        expect(hits.map((hit) => hit.place.id)).toEqual([online.id]);
      });

      it('reports distance from `near` for physical places and null for online ones', async () => {
        const data = new TestData();
        const physical = data.physicalPlace({
          name: 'Fiskebutikken',
          location: offset(OSLO_S, 1000),
        });
        const online = data.onlinePlace({ name: 'Fiskebutikken' });
        await fixture.current.writer.create(physical);
        await fixture.current.writer.create(online);

        const hits = await fixture.current.reader.search({
          text: 'Fiskebutikken',
          near: OSLO_S,
          limit: 10,
        });
        const byId = new Map(hits.map((hit) => [hit.place.id, hit]));

        expect(byId.get(physical.id)?.distanceM).toBeCloseTo(1000, -1);
        expect(byId.get(online.id)?.distanceM).toBeNull();
      });

      it('reports null distance when no `near` is given', async () => {
        const place = new TestData().physicalPlace({ name: 'Blomsterbutikken' });
        await fixture.current.writer.create(place);

        const [hit] = await fixture.current.reader.search({ text: 'Blomsterbutikken', limit: 10 });

        expect(hit?.distanceM).toBeNull();
      });
    });

    describe('nearby', () => {
      it('returns physical places within the radius, nearest first', async () => {
        const data = new TestData();
        const far = data.physicalPlace({ location: offset(OSLO_S, 800) });
        const near = data.physicalPlace({ location: offset(OSLO_S, 100) });
        const middle = data.physicalPlace({ location: offset(OSLO_S, 0, 400) });
        const outside = data.physicalPlace({ location: offset(OSLO_S, 3000) });
        for (const place of [far, near, middle, outside]) {
          await fixture.current.writer.create(place);
        }
        await fixture.current.writer.create(data.onlinePlace());

        const hits = await fixture.current.reader.nearby({
          center: OSLO_S,
          radiusM: 1000,
          limit: 10,
        });

        expect(hits.map((hit) => hit.place.id)).toEqual([near.id, middle.id, far.id]);
        expect(hits[0]?.distanceM).toBeCloseTo(100, -1);
      });

      it('respects limit', async () => {
        const data = new TestData();
        for (const metres of [10, 20, 30]) {
          await fixture.current.writer.create(
            data.physicalPlace({ location: offset(OSLO_S, metres) }),
          );
        }

        const hits = await fixture.current.reader.nearby({
          center: OSLO_S,
          radiusM: 1000,
          limit: 2,
        });

        expect(hits).toHaveLength(2);
      });

      it('returns an empty list when nothing is within the radius', async () => {
        await fixture.current.writer.create(
          new TestData().physicalPlace({ location: offset(OSLO_S, 2000) }),
        );

        await expect(
          fixture.current.reader.nearby({ center: OSLO_S, radiusM: 500, limit: 10 }),
        ).resolves.toEqual([]);
      });
    });
  });
}

export interface PlaceWriterFixture {
  readonly writer: PlaceWriter;
  /** Used only to assert. */
  readonly reader: PlaceReader;
}

/** Behaviour every PlaceWriter must have. */
export function describePlaceWriterContract(
  name: string,
  factory: FixtureFactory<PlaceWriterFixture>,
): void {
  describe(`${name} satisfies PlaceWriter`, () => {
    const fixture = new FixtureHolder(factory);

    function sourceRecord(
      data: TestData,
      overrides: Partial<PlaceSourceRecord> = {},
    ): PlaceSourceRecord {
      const place = data.physicalPlace();
      return {
        osmRef: place.osmRef ?? 'node/1',
        name: place.name,
        category: place.category,
        address: place.address,
        location: place.location,
        website: null,
        chainId: null,
        ...overrides,
      };
    }

    describe('create', () => {
      it('throws ConflictError for an existing id', async () => {
        const data = new TestData();
        const place = data.physicalPlace();
        await fixture.current.writer.create(place);

        await expect(
          fixture.current.writer.create(data.physicalPlace({ id: place.id })),
        ).rejects.toBeInstanceOf(ConflictError);
      });

      it('throws ConflictError for an osmRef that is already taken', async () => {
        const data = new TestData();
        await fixture.current.writer.create(data.physicalPlace({ osmRef: 'node/42' }));

        await expect(
          fixture.current.writer.create(data.physicalPlace({ osmRef: 'node/42' })),
        ).rejects.toBeInstanceOf(ConflictError);
      });

      it('allows many physical places without an osmRef', async () => {
        const data = new TestData();
        await fixture.current.writer.create(data.physicalPlace({ osmRef: null }));

        await expect(
          fixture.current.writer.create(data.physicalPlace({ osmRef: null })),
        ).resolves.toBeUndefined();
      });
    });

    describe('upsertFromSource', () => {
      it('creates once, then reports unchanged for the same record', async () => {
        const data = new TestData();
        const record = sourceRecord(data);
        const newId = data.placeId();

        const first = await fixture.current.writer.upsertFromSource(record, newId);
        const second = await fixture.current.writer.upsertFromSource(record, data.placeId());

        expect(first).toEqual({ placeId: newId, outcome: 'created' });
        expect(second).toEqual({ placeId: newId, outcome: 'unchanged' });
        await expect(fixture.current.reader.getById(newId)).resolves.toMatchObject({
          kind: 'physical',
          name: record.name,
          osmRef: record.osmRef,
        });
      });

      it('updates changed fields and keeps id, createdAt and brregOrgnr', async () => {
        const data = new TestData();
        const record = sourceRecord(data);
        const { placeId } = await fixture.current.writer.upsertFromSource(record, data.placeId());
        await fixture.current.writer.attachBrregOrgnr(placeId, '987654321');
        const before = await fixture.current.reader.getById(placeId);

        const result = await fixture.current.writer.upsertFromSource(
          { ...record, name: 'Nytt navn' },
          data.placeId(),
        );
        const after = await fixture.current.reader.getById(placeId);

        expect(result).toEqual({ placeId, outcome: 'updated' });
        expect(after).toMatchObject({ id: placeId, name: 'Nytt navn', brregOrgnr: '987654321' });
        expect(after.createdAt).toEqual(before.createdAt);
      });
    });

    describe('attachBrregOrgnr', () => {
      it('sets the organisation number', async () => {
        const place = new TestData().physicalPlace();
        await fixture.current.writer.create(place);

        await fixture.current.writer.attachBrregOrgnr(place.id, '912345678');

        await expect(fixture.current.reader.getById(place.id)).resolves.toMatchObject({
          brregOrgnr: '912345678',
        });
      });

      it('throws NotFoundError for an unknown place', async () => {
        await expect(
          fixture.current.writer.attachBrregOrgnr(new TestData().placeId(), '912345678'),
        ).rejects.toBeInstanceOf(NotFoundError);
      });

      it('throws NotFoundError for an online place', async () => {
        const place = new TestData().onlinePlace();
        await fixture.current.writer.create(place);

        await expect(
          fixture.current.writer.attachBrregOrgnr(place.id, '912345678'),
        ).rejects.toBeInstanceOf(NotFoundError);
      });
    });
  });
}
