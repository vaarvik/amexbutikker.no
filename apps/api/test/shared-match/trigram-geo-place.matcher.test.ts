import type { Clock, ParsedSharedPlace, PhysicalPlace } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import { TrigramNameSimilarity } from '@amexbutikker/domain';
import { EmptyInMemoryTablesFactory, InMemoryPlaceRepository } from '@amexbutikker/in-memory';
import { beforeEach, describe, expect, it } from 'vitest';
import { TrigramGeoPlaceMatcher } from '../../src/shared-match/trigram-geo-place.matcher.js';

const clock: Clock = { now: () => new Date('2026-11-05T10:00:00Z') };
const names = new TrigramNameSimilarity();
const data = new TestData();
const config = { radiusM: 300, searchLimit: 20, minimumScore: 0.25 };

function shared(overrides: Partial<ParsedSharedPlace> = {}): ParsedSharedPlace {
  return {
    provider: 'apple_maps',
    name: null,
    street: null,
    postcode: null,
    city: null,
    location: null,
    urls: [],
    ...overrides,
  };
}

function place(
  name: string,
  street: string | null,
  postcode: string | null,
  location = { lat: 59.9139, lng: 10.7522 },
): PhysicalPlace {
  return data.physicalPlace({ name, address: { street, postcode, city: 'Oslo' }, location });
}

describe('TrigramGeoPlaceMatcher', () => {
  let repository: InMemoryPlaceRepository;
  let matcher: TrigramGeoPlaceMatcher;
  const kaffe = place('Kaffebrenneriet', 'Storgata 2', '0155');
  const kaffeAker = place('Kaffebrenneriet Aker Brygge', 'Stranden 1', '0250', {
    lat: 59.9105,
    lng: 10.7275,
  });
  const neighbour = place('Narvesen', 'Storgata 2', '0155');
  const online = data.onlinePlace({ name: 'Kaffebrenneriet nettbutikk' });

  beforeEach(async () => {
    repository = new InMemoryPlaceRepository(
      new EmptyInMemoryTablesFactory().create(),
      names,
      clock,
    );
    for (const p of [kaffe, kaffeAker, neighbour, online]) {
      await repository.create(p);
    }
    matcher = new TrigramGeoPlaceMatcher(repository, names, config);
  });

  it('ranks the place with the same name, street, postcode and position first', async () => {
    const [top, ...rest] = await matcher.match(
      shared({
        name: 'Kaffebrenneriet',
        street: 'Storgata 2',
        postcode: '0155',
        location: { lat: 59.9139, lng: 10.7522 },
      }),
    );

    expect(top?.place.id).toBe(kaffe.id);
    expect(top?.score).toBeCloseTo(1, 5);
    expect(top?.reasons).toEqual([
      { kind: 'name', similarity: 1 },
      { kind: 'street' },
      { kind: 'postcode' },
      { kind: 'distance', distanceM: 0 },
    ]);
    expect(rest.every((candidate) => candidate.score < (top?.score ?? 0))).toBe(true);
    expect(rest.map((candidate) => candidate.place.id)).not.toContain(online.id);
  });

  it('counts a name contained in a longer one as a strong match', async () => {
    const [top] = await matcher.match(shared({ name: 'Kaffebrenneriet Aker Brygge' }));

    expect(top?.place.id).toBe(kaffeAker.id);
    const second = (await matcher.match(shared({ name: 'Kaffebrenneriet' })))[1];
    expect(second?.reasons[0]).toEqual({ kind: 'name', similarity: 0.85 });
  });

  it('matches on name alone when that is all the share has', async () => {
    const candidates = await matcher.match(shared({ name: 'Kaffebrenneriet' }));

    expect(candidates[0]?.place.id).toBe(kaffe.id);
    expect(candidates.map((candidate) => candidate.place.kind)).not.toContain('online');
  });

  it('finds a place by position and postcode when the name differs', async () => {
    const candidates = await matcher.match(
      shared({ name: 'Narvesen Storgata', postcode: '0155', location: kaffe.location }),
    );

    expect(candidates[0]?.place.id).toBe(neighbour.id);
  });

  it('measures the distance of a place found only by postcode', async () => {
    const candidates = await matcher.match(
      shared({ postcode: '0250', location: { lat: 59.92, lng: 10.75 } }),
    );

    expect(candidates[0]?.place.id).toBe(kaffeAker.id);
    expect(candidates[0]?.reasons).toEqual([
      { kind: 'postcode' },
      { kind: 'distance', distanceM: 1640 },
    ]);
    // Same postcode (weight 0.1) but far outside the radius (distance weight 0.15, value 0).
    expect(candidates[0]?.score).toBeCloseTo(0.4, 5);
  });

  it('scores a different postcode and street down', async () => {
    const [top] = await matcher.match(
      shared({ name: 'Kaffebrenneriet', street: 'Stranden 1', postcode: '0250' }),
    );

    expect(top?.place.id).toBe(kaffeAker.id);
  });

  it('returns nothing for a share it cannot use', async () => {
    await expect(matcher.match(shared())).resolves.toEqual([]);
    await expect(matcher.match(shared({ name: 'Finnes ikke i det hele tatt' }))).resolves.toEqual(
      [],
    );
  });

  it('returns at most three candidates, ties by name', async () => {
    for (const n of [1, 2, 3, 4]) {
      await repository.create(place(`Kiosk ${String(n)}`, 'Storgata 2', '0155'));
    }

    const candidates = await new TrigramGeoPlaceMatcher(repository, names, {
      ...config,
      minimumScore: 0,
    }).match(shared({ street: 'Storgata 2', postcode: '0155' }));

    expect(candidates).toHaveLength(3);
    expect(candidates.map((candidate) => candidate.place.name)).toEqual([
      'Kaffebrenneriet',
      'Kiosk 1',
      'Kiosk 2',
    ]);
  });
});
