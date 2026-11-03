import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * Extensions, and `f_normalize_name`: the IMMUTABLE wrapper that makes
 * unaccent(lower(name)) indexable. It also trims and collapses whitespace, matching
 * NameSimilarity.normalize in the domain.
 */
export class M0001Extensions implements Migration {
  public async up(db: Kysely<unknown>): Promise<void> {
    await sql`CREATE EXTENSION IF NOT EXISTS postgis`.execute(db);
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);
    await sql`CREATE EXTENSION IF NOT EXISTS unaccent`.execute(db);
    await sql`
      CREATE FUNCTION f_normalize_name(value text) RETURNS text
      LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
      AS $$ SELECT regexp_replace(btrim(public.unaccent('public.unaccent'::regdictionary, lower(value))), '\\s+', ' ', 'g') $$
    `.execute(db);
  }

  public async down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP FUNCTION f_normalize_name(text)`.execute(db);
  }
}
