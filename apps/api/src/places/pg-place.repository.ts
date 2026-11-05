import { ConflictError, NotFoundError, PlaceSchema } from '@amexbutikker/contracts';
import type {
  ChainId,
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
import { sql } from 'kysely';
import type { Kysely, RawBuilder } from 'kysely';
import { z } from 'zod';
import type { Database } from '../shared/shared.model.js';
import type { DatabaseErrorTranslator } from '../shared/shared.ports.js';

/** The words pg_trgm extracts trigrams from; words contain no LIKE wildcards. */
const WORD = /[\p{L}\p{N}]+/gu;

const PlaceRowSchema = z.object({
  id: z.string(),
  kind: z.enum(['physical', 'online']),
  chain_id: z.string().nullable(),
  name: z.string(),
  category: z.string(),
  street: z.string().nullable(),
  postcode: z.string().nullable(),
  city: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  website: z.string().nullable(),
  osm_ref: z.string().nullable(),
  brreg_orgnr: z.string().nullable(),
  created_at: z.date(),
});
type PlaceRow = z.infer<typeof PlaceRowSchema>;

const PLACE_COLUMNS = sql`
  p.id, p.kind, p.chain_id, p.name, p.category, p.street, p.postcode, p.city,
  ST_Y(p.geom::geometry) AS lat, ST_X(p.geom::geometry) AS lng,
  p.website, p.osm_ref, p.brreg_orgnr, p.created_at
`;

export class PgPlaceRepository implements PlaceReader, PlaceWriter {
  public constructor(
    private readonly db: Kysely<Database>,
    private readonly names: NameSimilarity,
    private readonly errors: DatabaseErrorTranslator,
  ) {}

  public async getById(id: PlaceId): Promise<Place> {
    const { rows } = await sql`SELECT ${PLACE_COLUMNS} FROM places p WHERE p.id = ${id}`.execute(
      this.db,
    );
    const [row] = rows;
    if (row === undefined) {
      throw new NotFoundError('Place', id);
    }
    return this.toPlace(row);
  }

  public async search(query: PlaceSearchQuery): Promise<PlaceSearchHit[]> {
    const text = this.names.normalize(query.text);
    const words = Array.from(text.matchAll(WORD), ([word]) => word);
    if (words.length === 0) {
      return [];
    }
    // Every word must match a word of the name, so the GIN index intersects one small set per
    // word instead of returning every name that shares a single word.
    const matches = words.map((word) => sql`${word} <% p.normalized_name`);
    const distance =
      query.near === undefined
        ? sql`NULL::double precision`
        : sql`CASE WHEN p.geom IS NULL THEN NULL ELSE ST_Distance(p.geom, ${this.point(query.near)}) END`;
    const { rows } = await sql`
      SELECT ${PLACE_COLUMNS},
        similarity(p.normalized_name, ${text}) AS score,
        ${distance} AS distance_m
      FROM places p
      WHERE ${sql.join(matches, sql` AND `)}
        AND (${query.kind ?? null}::text IS NULL OR p.kind = ${query.kind ?? null})
      ORDER BY score DESC, distance_m ASC NULLS LAST, p.name ASC
      LIMIT ${query.limit}
    `.execute(this.db);
    const scored = z.object({ score: z.number(), distance_m: z.number().nullable() });
    return rows.map((row) => {
      const { score, distance_m } = scored.parse(row);
      return { place: this.toPlace(row), score: Math.min(1, score), distanceM: distance_m };
    });
  }

  public async nearby(query: NearbyQuery): Promise<NearbyPlaceHit[]> {
    const center = this.point(query.center);
    const { rows } = await sql`
      SELECT ${PLACE_COLUMNS}, ST_Distance(p.geom, ${center}) AS distance_m
      FROM places p
      WHERE p.kind = 'physical' AND ST_DWithin(p.geom, ${center}, ${query.radiusM})
      ORDER BY p.geom <-> ${center}
      LIMIT ${query.limit}
    `.execute(this.db);
    const distance = z.object({ distance_m: z.number() });
    return rows.map((row) => ({
      place: this.toPhysical(row),
      distanceM: distance.parse(row).distance_m,
    }));
  }

  public async listByPostcode(postcode: string): Promise<PhysicalPlace[]> {
    const { rows } = await sql`
      SELECT ${PLACE_COLUMNS} FROM places p WHERE p.postcode = ${postcode} AND p.kind = 'physical'
    `.execute(this.db);
    return rows.map((row) => this.toPhysical(row));
  }

  public async listByChain(chainId: ChainId): Promise<PhysicalPlace[]> {
    const { rows } = await sql`
      SELECT ${PLACE_COLUMNS} FROM places p WHERE p.chain_id = ${chainId} AND p.kind = 'physical'
    `.execute(this.db);
    return rows.map((row) => this.toPhysical(row));
  }

  public async create(place: Place): Promise<void> {
    const physical = place.kind === 'physical' ? place : null;
    try {
      await sql`
        INSERT INTO places
          (id, kind, chain_id, name, category, street, postcode, city, geom, website, osm_ref, brreg_orgnr, created_at)
        VALUES (
          ${place.id}, ${place.kind}, ${physical?.chainId ?? null}, ${place.name}, ${place.category},
          ${physical?.address.street ?? null}, ${physical?.address.postcode ?? null}, ${physical?.address.city ?? null},
          ${physical === null ? null : this.point(physical.location)},
          ${place.website}, ${physical?.osmRef ?? null}, ${physical?.brregOrgnr ?? null}, ${place.createdAt}
        )
      `.execute(this.db);
    } catch (error) {
      throw this.errors.translate(error, {
        places_pkey: () => new ConflictError(`Place ${place.id} already exists.`),
        places_osm_ref_key: () =>
          new ConflictError(`osmRef ${physical?.osmRef ?? ''} is already taken.`),
        places_chain_id_fkey: () => new NotFoundError('Chain', physical?.chainId ?? ''),
      });
    }
  }

  public async upsertFromSource(
    record: PlaceSourceRecord,
    newId: PlaceId,
  ): Promise<PlaceUpsertResult> {
    const { address } = record;
    const point = this.point(record.location);
    const { rows } = await sql`
      INSERT INTO places (id, kind, chain_id, name, category, street, postcode, city, geom, website, osm_ref)
      VALUES (${newId}, 'physical', ${record.chainId}, ${record.name}, ${record.category}, ${address.street},
        ${address.postcode}, ${address.city}, ${point}, ${record.website}, ${record.osmRef})
      ON CONFLICT (osm_ref) DO UPDATE SET
        chain_id = EXCLUDED.chain_id, name = EXCLUDED.name, category = EXCLUDED.category,
        street = EXCLUDED.street, postcode = EXCLUDED.postcode, city = EXCLUDED.city,
        geom = EXCLUDED.geom, website = EXCLUDED.website
      WHERE (places.chain_id, places.name, places.category, places.street, places.postcode, places.city,
             ST_AsEWKB(places.geom::geometry), places.website)
        IS DISTINCT FROM
            (EXCLUDED.chain_id, EXCLUDED.name, EXCLUDED.category, EXCLUDED.street, EXCLUDED.postcode, EXCLUDED.city,
             ST_AsEWKB(EXCLUDED.geom::geometry), EXCLUDED.website)
      RETURNING id, (xmax = 0) AS inserted
    `.execute(this.db);
    const [row] = rows;
    if (row !== undefined) {
      const { id, inserted } = z.object({ id: z.string(), inserted: z.boolean() }).parse(row);
      return { placeId: id as PlaceId, outcome: inserted ? 'created' : 'updated' };
    }
    const existing = await sql`SELECT id FROM places WHERE osm_ref = ${record.osmRef}`.execute(
      this.db,
    );
    const { id } = z.object({ id: z.string() }).parse(existing.rows[0]);
    return { placeId: id as PlaceId, outcome: 'unchanged' };
  }

  public async attachBrregOrgnr(placeId: PlaceId, orgnr: string): Promise<void> {
    const result = await sql`
      UPDATE places SET brreg_orgnr = ${orgnr} WHERE id = ${placeId} AND kind = 'physical'
    `.execute(this.db);
    if (result.numAffectedRows === 0n) {
      throw new NotFoundError('Physical place', placeId);
    }
  }

  private point(point: GeoPoint): RawBuilder<unknown> {
    return sql`ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography`;
  }

  private toPhysical(row: unknown): PhysicalPlace {
    const place = this.toPlace(row);
    if (place.kind !== 'physical') {
      throw new Error(`Expected a physical place, got ${place.kind}.`);
    }
    return place;
  }

  private toPlace(raw: unknown): Place {
    const row: PlaceRow = PlaceRowSchema.parse(raw);
    const base = { id: row.id, name: row.name, category: row.category, createdAt: row.created_at };
    return PlaceSchema.parse(
      row.kind === 'online'
        ? { ...base, kind: 'online', website: row.website }
        : {
            ...base,
            kind: 'physical',
            website: row.website,
            chainId: row.chain_id,
            address: { street: row.street, postcode: row.postcode, city: row.city },
            location: { lat: row.lat, lng: row.lng },
            osmRef: row.osm_ref,
            brregOrgnr: row.brreg_orgnr,
          },
    );
  }
}
