import { ConflictError, NotFoundError } from '@amexbutikker/contracts';
import type {
  Clock,
  GeoPoint,
  NameSimilarity,
  NearbyPlaceHit,
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
import type { InMemoryTables } from '../shared/in-memory.ports.js';

const EARTH_RADIUS_M = 6_371_008.8;

export class InMemoryPlaceRepository implements PlaceReader, PlaceWriter {
  public constructor(
    private readonly tables: InMemoryTables,
    private readonly names: NameSimilarity,
    private readonly clock: Clock,
    private readonly minimumSimilarity = 0.3,
  ) {}

  public getById(id: PlaceId): Promise<Place> {
    const place = this.tables.places.get(id);
    return place === undefined
      ? Promise.reject(new NotFoundError('Place', id))
      : Promise.resolve(place);
  }

  public search(query: PlaceSearchQuery): Promise<PlaceSearchHit[]> {
    const text = this.names.normalize(query.text);
    const hits: PlaceSearchHit[] = [];
    for (const place of this.tables.places.values()) {
      if (query.kind !== undefined && place.kind !== query.kind) {
        continue;
      }
      const name = this.names.normalize(place.name);
      const score = this.names.similarity(text, name);
      if (score < this.minimumSimilarity && !name.includes(text)) {
        continue;
      }
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

  public nearby(query: NearbyQuery): Promise<NearbyPlaceHit[]> {
    const hits: NearbyPlaceHit[] = [];
    for (const place of this.tables.places.values()) {
      if (place.kind !== 'physical') {
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

  public attachBrregOrgnr(placeId: PlaceId, orgnr: string): Promise<void> {
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
