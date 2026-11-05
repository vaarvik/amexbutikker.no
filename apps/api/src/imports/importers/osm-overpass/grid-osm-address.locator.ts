import type { Address, GeoPoint } from '@amexbutikker/contracts';
import type { OsmAddressIndex, OsmAddressPoint } from './osm-overpass.model.js';
import type { OsmAddressLocator } from './osm-overpass.ports.js';

const EARTH_RADIUS_M = 6_371_008.8;

/**
 * Buckets address points in a lat/lng grid and searches the 3×3 cells around a location.
 * With 0.0005° cells (about 55 m), distances up to one cell edge are found exactly.
 */
export class GridOsmAddressLocator implements OsmAddressLocator {
  public constructor(private readonly cellDegrees: number) {}

  public index(points: readonly OsmAddressPoint[]): OsmAddressIndex {
    const cells = new Map<string, OsmAddressPoint[]>();
    for (const point of points) {
      const [row, column] = this.cellOf(point.location);
      const key = this.key(row, column);
      const cell = cells.get(key);
      if (cell === undefined) {
        cells.set(key, [point]);
      } else {
        cell.push(point);
      }
    }
    return { cellDegrees: this.cellDegrees, cells };
  }

  public nearest(index: OsmAddressIndex, location: GeoPoint, maxDistanceM: number): Address | null {
    const [row, column] = this.cellOf(location);
    let best: { readonly address: Address; readonly distanceM: number } | null = null;
    for (let dRow = -1; dRow <= 1; dRow += 1) {
      for (let dColumn = -1; dColumn <= 1; dColumn += 1) {
        for (const point of index.cells.get(this.key(row + dRow, column + dColumn)) ?? []) {
          const distanceM = this.distance(location, point.location);
          if (distanceM <= maxDistanceM && (best === null || distanceM < best.distanceM)) {
            best = { address: point.address, distanceM };
          }
        }
      }
    }
    return best?.address ?? null;
  }

  private cellOf(location: GeoPoint): readonly [number, number] {
    return [
      Math.floor(location.lat / this.cellDegrees),
      Math.floor(location.lng / (2 * this.cellDegrees)),
    ];
  }

  private key(row: number, column: number): string {
    return `${String(row)}:${String(column)}`;
  }

  private distance(a: GeoPoint, b: GeoPoint): number {
    const toRad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toRad;
    const dLng = (b.lng - a.lng) * toRad;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
  }
}
