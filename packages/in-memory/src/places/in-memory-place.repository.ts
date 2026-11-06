import { ConflictError, NotFoundError } from '@amexbutikker/contracts';
import type {
  ChainId,
  Clock,
  GeoPoint,
  NameSimilarity,
  NearbyPlaceHit,
  AreaQuery,
  PlaceFilter,
  NearbyQuery,
  PhysicalPlace,
  Place,
  PlaceId,
  PlaceReader,
  PlaceSearchHit,
  PlaceSearchQuery,
  PlaceSourceRecord,
  PlaceUpsertResult,
  PlaceWriter,
} from '@amexbutikker/contracts';
import type { InMemoryTables } from '../shared/shared.ports.js';

const EARTH_RADIUS_M = 6_371_008.8;
const WORD = /[\p{L}\p{N}]+/gu;

export class InMemoryPlaceRepository implements PlaceReader, PlaceWriter {
  public constructor(
    private readonly tables: InMemoryTables,
    private readonly names: NameSimilarity,
    private readonly clock: Clock,
    private readonly minimumWordSimilarity = 0.5,
  ) {}

  public getById(id: PlaceId): Promise<Place> {
    const place = this.tables.places.get(id);
    return place === undefined
      ? Promise.reject(new NotFoundError('Place', id))
      : Promise.resolve(place);
  }

  public search(query: PlaceSearchQuery): Promise<PlaceSearchHit[]> {
    const text = this.names.normalize(query.text);
    const words = this.words(text);
    const hits: PlaceSearchHit[] = [];
    for (const place of this.tables.places.values()) {
      if (
        (query.kind !== undefined && place.kind !== query.kind) ||
        !this.passes(place, query.filter)
      ) {
        continue;
      }
      const name = this.names.normalize(place.name);
      if (words.length === 0 || !words.every((word) => this.matchesWord(word, name))) {
        continue;
      }
      const score = this.names.similarity(text, name);
      const distanceM =
        query.near !== undefined && place.kind === 'physical'
          ? this.distance(query.near, place.location)
          : null;
      hits.push({ place, score, distanceM });
    }
    hits.sort(
      (a, b) =>
        b.score - a.score ||
        (a.distanceM ?? Number.POSITIVE_INFINITY) - (b.distanceM ?? Number.POSITIVE_INFINITY) ||
        a.place.name.localeCompare(b.place.name),
    );
    return Promise.resolve(hits.slice(0, query.limit));
  }

  private passes(place: Place, filter: PlaceFilter | undefined): boolean {
    if (filter?.categories !== undefined && !filter.categories.includes(place.category)) {
      return false;
    }
    if (filter?.acceptsOnly === true) {
      const status = this.tables.statuses.get(place.id)?.status.status;
      return status === 'accepted' || status === 'likely_accepted';
    }
    return true;
  }

  /** A query word matches a name that contains it, or a name word with a close spelling. */
  private matchesWord(word: string, name: string): boolean {
    return (
      name.includes(word) ||
      this.words(name).some(
        (candidate) => this.names.similarity(word, candidate) >= this.minimumWordSimilarity,
      )
    );
  }

  private words(text: string): string[] {
    return Array.from(text.matchAll(WORD), ([word]) => word);
  }

  public listNearby(query: NearbyQuery): Promise<NearbyPlaceHit[]> {
    const hits: NearbyPlaceHit[] = [];
    for (const place of this.tables.places.values()) {
      if (place.kind !== 'physical' || !this.passes(place, query.filter)) {
        continue;
      }
      const distanceM = this.distance(query.center, place.location);
      if (distanceM <= query.radiusM) {
        hits.push({ place, distanceM });
      }
    }
    hits.sort((a, b) => a.distanceM - b.distanceM);
    return Promise.resolve(hits.slice(0, query.limit));
  }

  public listInArea(query: AreaQuery): Promise<PhysicalPlace[]> {
    const { south, west, north, east } = query.bounds;
    const centre = { lat: (south + north) / 2, lng: (west + east) / 2 };
    const inside = [...this.tables.places.values()].filter(
      (place): place is PhysicalPlace =>
        place.kind === 'physical' &&
        place.location.lat >= south &&
        place.location.lat <= north &&
        place.location.lng >= west &&
        place.location.lng <= east &&
        (!query.answeredOnly ||
          (this.tables.statuses.get(place.id)?.status.status ?? 'unknown') !== 'unknown'),
    );
    inside.sort((a, b) => this.distance(centre, a.location) - this.distance(centre, b.location));
    return Promise.resolve(inside.slice(0, query.limit));
  }

  public listByPostcode(postcode: string): Promise<PhysicalPlace[]> {
    return Promise.resolve(
      [...this.tables.places.values()].filter(
        (place): place is PhysicalPlace =>
          place.kind === 'physical' && place.address.postcode === postcode,
      ),
    );
  }

  public listByChain(chainId: ChainId): Promise<PhysicalPlace[]> {
    return Promise.resolve(
      [...this.tables.places.values()].filter(
        (place): place is PhysicalPlace => place.kind === 'physical' && place.chainId === chainId,
      ),
    );
  }

  public create(place: Place): Promise<void> {
    if (this.tables.places.has(place.id)) {
      return Promise.reject(new ConflictError(`Place ${place.id} already exists.`));
    }
    if (place.kind === 'physical' && place.osmRef !== null && this.findByOsmRef(place.osmRef)) {
      return Promise.reject(new ConflictError(`osmRef ${place.osmRef} is already taken.`));
    }
    this.tables.places.set(place.id, place);
    return Promise.resolve();
  }

  public upsertFromSource(record: PlaceSourceRecord, newId: PlaceId): Promise<PlaceUpsertResult> {
    const existing = this.findByOsmRef(record.osmRef);
    if (existing === undefined) {
      this.tables.places.set(newId, {
        kind: 'physical',
        id: newId,
        createdAt: this.clock.now(),
        brregOrgnr: null,
        ...record,
      });
      return Promise.resolve({ placeId: newId, outcome: 'created' });
    }
    const updated: PhysicalPlace = { ...existing, ...record };
    if (this.sameSourceFields(existing, updated)) {
      return Promise.resolve({ placeId: existing.id, outcome: 'unchanged' });
    }
    this.tables.places.set(existing.id, updated);
    return Promise.resolve({ placeId: existing.id, outcome: 'updated' });
  }

  public saveBrregOrgnr(placeId: PlaceId, orgnr: string): Promise<void> {
    const place = this.tables.places.get(placeId);
    if (place?.kind !== 'physical') {
      return Promise.reject(new NotFoundError('Physical place', placeId));
    }
    this.tables.places.set(placeId, { ...place, brregOrgnr: orgnr });
    return Promise.resolve();
  }

  private findByOsmRef(osmRef: string): PhysicalPlace | undefined {
    for (const place of this.tables.places.values()) {
      if (place.kind === 'physical' && place.osmRef === osmRef) {
        return place;
      }
    }
    return undefined;
  }

  private sameSourceFields(a: PhysicalPlace, b: PhysicalPlace): boolean {
    const fields = (place: PhysicalPlace) =>
      JSON.stringify([
        place.name,
        place.category,
        place.address,
        place.location,
        place.website,
        place.chainId,
      ]);
    return fields(a) === fields(b);
  }

  /** Haversine great-circle distance in metres. */
  private distance(from: GeoPoint, to: GeoPoint): number {
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const dLat = radians(to.lat - from.lat);
    const dLng = radians(to.lng - from.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
  }
}
