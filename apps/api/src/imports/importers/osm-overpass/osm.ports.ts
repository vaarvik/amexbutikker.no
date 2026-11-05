import type {
  Address,
  ChainSourceRecord,
  GeoPoint,
  PlaceSourceRecord,
} from '@amexbutikker/contracts';
import type { OsmAddressIndex, OsmAddressPoint, OverpassElement } from './osm.model.js';

/** A raw Overpass API response and when it was fetched. */
export interface OverpassResponse {
  /** The parsed JSON body, not yet validated. */
  readonly body: unknown;
  readonly fetchedAt: Date;
}

/** Sends one Overpass QL query. */
export interface OverpassClient {
  /**
   * @throws Error when the endpoint is unreachable or answers with a non-2xx status (Overpass
   *   answers 429 and 504 when busy; callers report that, they do not retry in a loop).
   * @throws the signal's reason when aborted.
   */
  fetch(query: string, signal?: AbortSignal): Promise<OverpassResponse>;
}

/** What one OSM element means for the place model. */
export type OsmTranslation =
  | {
      readonly kind: 'place';
      /** The place without its chain; the importer resolves `chain` to an id first. */
      readonly place: Omit<PlaceSourceRecord, 'chainId'>;
      readonly chain: ChainSourceRecord | null;
      /** Tags that were present but unusable, e.g. a malformed postcode. */
      readonly warnings: readonly string[];
    }
  | { readonly kind: 'skipped'; readonly reason: string };

/** Anti-corruption layer: OSM tags in, place model out. Pure. */
export interface OsmElementTranslator {
  translate(element: OverpassElement): OsmTranslation;

  /** The element's location and street address, or null without a street and house number. */
  addressPoint(element: OverpassElement): OsmAddressPoint | null;
}

/** Finds the address nearest to a point. Pure. */
export interface OsmAddressLocator {
  index(points: readonly OsmAddressPoint[]): OsmAddressIndex;

  /** @returns the address of the nearest point within `maxDistanceM`, or null. */
  nearest(index: OsmAddressIndex, location: GeoPoint, maxDistanceM: number): Address | null;
}
