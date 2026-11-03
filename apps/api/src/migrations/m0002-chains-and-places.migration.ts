import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export class M0002ChainsAndPlacesMigration implements Migration {
  public async up(db: Kysely<unknown>): Promise<void> {
    await sql`
      CREATE TABLE chains (
        id uuid PRIMARY KEY,
        name text NOT NULL CHECK (length(btrim(name)) > 0),
        brand_wikidata text UNIQUE CHECK (brand_wikidata ~ '^Q[0-9]+$'),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `.execute(db);
    await sql`CREATE INDEX chains_normalized_name_idx ON chains (f_normalize_name(name))`.execute(
      db,
    );

    await sql`
      CREATE TABLE places (
        id uuid PRIMARY KEY,
        kind text NOT NULL CHECK (kind IN ('physical', 'online')),
        chain_id uuid REFERENCES chains (id),
        name text NOT NULL CHECK (length(btrim(name)) > 0),
        category text NOT NULL CHECK (category IN
          ('restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'shop', 'hotel', 'online_shop', 'other')),
        street text,
        postcode text CHECK (postcode ~ '^[0-9]{4}$'),
        city text,
        geom geography(Point, 4326),
        website text,
        osm_ref text UNIQUE CHECK (osm_ref ~ '^(node|way|relation)/[0-9]+$'),
        brreg_orgnr text CHECK (brreg_orgnr ~ '^[0-9]{9}$'),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT places_location_by_kind CHECK ((kind = 'physical') = (geom IS NOT NULL)),
        CONSTRAINT places_online_shape CHECK (
          kind = 'physical' OR (
            chain_id IS NULL AND osm_ref IS NULL AND brreg_orgnr IS NULL AND website IS NOT NULL
            AND street IS NULL AND postcode IS NULL AND city IS NULL
          )
        )
      )
    `.execute(db);
    await sql`CREATE INDEX places_geom_idx ON places USING gist (geom)`.execute(db);
    await sql`CREATE INDEX places_name_trgm_idx ON places USING gin (f_normalize_name(name) gin_trgm_ops)`.execute(
      db,
    );
    await sql`CREATE INDEX places_chain_id_idx ON places (chain_id) WHERE chain_id IS NOT NULL`.execute(
      db,
    );
  }

  public async down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE places`.execute(db);
    await sql`DROP TABLE chains`.execute(db);
  }
}
