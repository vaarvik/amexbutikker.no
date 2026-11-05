import type {
  GeoPoint,
  MatchReason,
  NameSimilarity,
  ParsedSharedPlace,
  PhysicalPlace,
  PlaceCandidate,
  PlaceId,
  PlaceMatcher,
  PlaceReader,
} from '@amexbutikker/contracts';

export interface TrigramGeoPlaceMatcherConfig {
  /** Places within this distance of shared coordinates are candidates; closer scores higher. */
  readonly radiusM: number;
  /** Hits taken from name search and from the nearby list. */
  readonly searchLimit: number;
  /** Candidates scoring lower are dropped. */
  readonly minimumScore: number;
}

/** Weight of each signal. A signal the shared text does not provide is left out of the average. */
const WEIGHTS = { name: 0.6, street: 0.15, distance: 0.15, postcode: 0.1 } as const;
const MAX_CANDIDATES = 3;
/**
 * Name score when every word of one name is in the other: maps apps and OSM often differ only
 * by a branch suffix ("Kaffebrenneriet" vs "Kaffebrenneriet Aker Brygge").
 */
const CONTAINED_NAME_SCORE = 0.85;
const SEARCH_TEXT_MAX = 100;
const EARTH_RADIUS_M = 6_371_000;

interface Gathered {
  readonly place: PhysicalPlace;
  readonly distanceM: number | null;
}

/**
 * Gathers candidates by name search, by distance to shared coordinates and by postcode, then
 * scores each on trigram name similarity, same street, same postcode and distance. The score is
 * the weighted average over the signals the shared text provides, so a share without coordinates
 * is not punished for it, but a different postcode is.
 */
export class TrigramGeoPlaceMatcher implements PlaceMatcher {
  public constructor(
    private readonly places: PlaceReader,
    private readonly names: NameSimilarity,
    private readonly config: TrigramGeoPlaceMatcherConfig,
  ) {}

  public async match(parsed: ParsedSharedPlace): Promise<PlaceCandidate[]> {
    const gathered = await this.gather(parsed);
    return [...gathered.values()]
      .map((candidate) => this.score(parsed, candidate))
      .filter((candidate) => candidate.score >= this.config.minimumScore)
      .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name, 'nb'))
      .slice(0, MAX_CANDIDATES);
  }

  private async gather(parsed: ParsedSharedPlace): Promise<Map<PlaceId, Gathered>> {
    const found = new Map<PlaceId, Gathered>();
    const add = (place: PhysicalPlace, distanceM: number | null) => {
      if (!found.has(place.id)) {
        found.set(place.id, { place, distanceM });
      }
    };
    const { location } = parsed;
    if (location !== null) {
      const nearby = await this.places.listNearby({
        center: location,
        radiusM: this.config.radiusM,
        limit: this.config.searchLimit,
      });
      for (const hit of nearby) {
        add(hit.place, hit.distanceM);
      }
    }
    if (parsed.name !== null) {
      const hits = await this.places.search({
        text: parsed.name.slice(0, SEARCH_TEXT_MAX),
        kind: 'physical',
        limit: this.config.searchLimit,
        ...(location === null ? {} : { near: location }),
      });
      for (const hit of hits) {
        if (hit.place.kind === 'physical') {
          add(hit.place, hit.distanceM);
        }
      }
    }
    if (parsed.postcode !== null) {
      for (const place of await this.places.listByPostcode(parsed.postcode)) {
        add(place, location === null ? null : this.distanceM(location, place.location));
      }
    }
    return found;
  }

  private score(parsed: ParsedSharedPlace, { place, distanceM }: Gathered): PlaceCandidate {
    const reasons: MatchReason[] = [];
    let weighted = 0;
    let weights = 0;
    const signal = (weight: number, value: number) => {
      weighted += weight * value;
      weights += weight;
    };

    if (parsed.name !== null) {
      const similarity = this.nameScore(parsed.name, place.name);
      signal(WEIGHTS.name, similarity);
      reasons.push({ kind: 'name', similarity });
    }
    if (parsed.street !== null && place.address.street !== null) {
      const same = this.street(parsed.street) === this.street(place.address.street);
      signal(WEIGHTS.street, same ? 1 : 0);
      if (same) reasons.push({ kind: 'street' });
    }
    if (parsed.postcode !== null && place.address.postcode !== null) {
      const same = parsed.postcode === place.address.postcode;
      signal(WEIGHTS.postcode, same ? 1 : 0);
      if (same) reasons.push({ kind: 'postcode' });
    }
    if (distanceM !== null) {
      signal(WEIGHTS.distance, Math.max(0, 1 - distanceM / this.config.radiusM));
      reasons.push({ kind: 'distance', distanceM: Math.round(distanceM) });
    }
    return { place, score: weights === 0 ? 0 : weighted / weights, reasons };
  }

  private nameScore(shared: string, known: string): number {
    const a = this.names.normalize(shared);
    const b = this.names.normalize(known);
    const words = (text: string) => text.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== '');
    const [fewer, more] = [words(a), words(b)].sort((x, y) => x.length - y.length);
    const contained =
      fewer !== undefined && more !== undefined && fewer.every((word) => more.includes(word));
    return Math.max(this.names.similarity(a, b), contained ? CONTAINED_NAME_SCORE : 0);
  }

  /** Normalised, with `9 B` written as `9b`. */
  private street(street: string): string {
    return this.names.normalize(street).replace(/(\d)\s+([a-z])\b/g, '$1$2');
  }

  /** Great-circle distance (haversine). */
  private distanceM(a: GeoPoint, b: GeoPoint): number {
    const rad = (degrees: number) => (degrees * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
  }
}
