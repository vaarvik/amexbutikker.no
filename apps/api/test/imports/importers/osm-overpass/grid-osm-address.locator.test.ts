import { describe, expect, it } from 'vitest';
import { GridOsmAddressLocator } from '../../../../src/imports/importers/osm-overpass/grid-osm-address.locator.js';
import type { OsmAddressPoint } from '../../../../src/imports/importers/osm-overpass/osm-overpass.model.js';

const locator = new GridOsmAddressLocator(0.0005);
const METRE_LAT = 1 / 111_195;

function point(street: string, lat: number, lng: number): OsmAddressPoint {
  return { location: { lat, lng }, address: { street, postcode: '0190', city: 'Oslo' } };
}

describe('GridOsmAddressLocator', () => {
  const origin = { lat: 59.91, lng: 10.75 };
  const index = locator.index([
    point('Near 1', origin.lat + 10 * METRE_LAT, origin.lng),
    point('Nearer 2', origin.lat - 6 * METRE_LAT, origin.lng),
    // Across a cell border, still close.
    point('Over the border 3', 59.91027, origin.lng),
    point('Far 4', origin.lat + 200 * METRE_LAT, origin.lng),
  ]);

  it('returns the address of the nearest point within the distance', () => {
    expect(locator.nearest(index, origin, 25)).toMatchObject({ street: 'Nearer 2' });
  });

  it('finds a point in a neighbouring cell', () => {
    expect(locator.nearest(index, { lat: 59.91024, lng: origin.lng }, 25)).toMatchObject({
      street: 'Over the border 3',
    });
  });

  it('returns null when every point is too far', () => {
    expect(locator.nearest(index, origin, 5)).toBeNull();
    expect(locator.nearest(index, { lat: 59.95, lng: 10.8 }, 25)).toBeNull();
  });

  it('indexes points by cell', () => {
    expect(index.cellDegrees).toBe(0.0005);
    expect([...index.cells.values()].flat()).toHaveLength(4);
  });
});
