import type { AcceptanceStatus, PlaceId } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { NearestVisitRegionSelector } from '../../src/visits/nearest-visit-region.selector';
import { physicalPlace, summary } from '../shared/mobile-test.data';

const id = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}` as PlaceId;

function at(n: number, status: AcceptanceStatus, distanceM: number | null) {
  const base = summary();
  return summary({
    place: physicalPlace({ id: id(n), name: `Sted ${String(n)}` }),
    status: { ...base.status, status },
    distanceM,
  });
}

describe('NearestVisitRegionSelector', () => {
  const selector = new NearestVisitRegionSelector({ maxRegions: 2, radiusM: 75 });

  it('watches the nearest places first, up to the maximum', () => {
    const regions = selector.select([
      at(1, 'unknown', 300),
      at(2, 'unknown', 50),
      at(3, 'unknown', 100),
    ]);

    expect(regions.map((region) => region.placeId)).toEqual([id(2), id(3)]);
    expect(regions[0]).toEqual({
      placeId: id(2),
      name: 'Sted 2',
      center: { lat: 59.915, lng: 10.752 },
      radiusM: 75,
      prompt: 'ask',
    });
  });

  it('asks about unknown and mixed places, announces accepted ones and skips rejected ones', () => {
    const all = new NearestVisitRegionSelector({ maxRegions: 10, radiusM: 75 });
    const regions = all.select([
      at(1, 'unknown', 10),
      at(2, 'mixed', 20),
      at(3, 'accepted', 30),
      at(4, 'rejected', 40),
    ]);

    expect(regions.map((region) => region.prompt)).toEqual(['ask', 'ask', 'announce']);
  });

  it('puts places without a distance last and skips online shops', () => {
    const online = summary({
      place: {
        kind: 'online',
        id: id(9),
        name: 'Nettbutikk',
        category: 'online_shop',
        website: 'https://example.no',
      },
      distanceM: null,
    });
    const regions = selector.select([online, at(1, 'unknown', null), at(2, 'unknown', 500)]);

    expect(regions.map((region) => region.placeId)).toEqual([id(2), id(1)]);
  });
});
