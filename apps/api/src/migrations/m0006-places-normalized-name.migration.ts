import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * Stores the normalised place name instead of computing it per row. Search rechecks every
 * trigram candidate, and calling f_normalize_name (unaccent plus regexes) twice per candidate
 * was most of the query time with 50 000 places.
 */
export class M0006PlacesNormalizedNameMigration implements Migration {
  public async up(db: Kysely<unknown>): Promise<void> {
    await sql`
      ALTER TABLE places
        ADD COLUMN normalized_name text GENERATED ALWAYS AS (f_normalize_name(name)) STORED
    `.execute(db);
    await sql`
      CREATE INDEX places_normalized_name_trgm_idx ON places USING gin (normalized_name gin_trgm_ops)
    `.execute(db);
    await sql`DROP INDEX places_name_trgm_idx`.execute(db);
  }

  public async down(db: Kysely<unknown>): Promise<void> {
    await sql`
      CREATE INDEX places_name_trgm_idx ON places USING gin (f_normalize_name(name) gin_trgm_ops)
    `.execute(db);
    await sql`DROP INDEX places_normalized_name_trgm_idx`.execute(db);
    await sql`ALTER TABLE places DROP COLUMN normalized_name`.execute(db);
  }
}
