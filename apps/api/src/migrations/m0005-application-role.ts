import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * The role the API runs as. It may read and write everything except changing or removing
 * evidence. Roles are cluster-wide, so down() revokes this database's grants and leaves the role.
 */
export class M0005ApplicationRole implements Migration {
  public async up(db: Kysely<unknown>): Promise<void> {
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'amexbutikker_app') THEN
          CREATE ROLE amexbutikker_app NOLOGIN;
        END IF;
      END
      $$
    `.execute(db);
    await sql`GRANT USAGE ON SCHEMA public TO amexbutikker_app`.execute(db);
    await sql`
      GRANT SELECT, INSERT, UPDATE, DELETE
      ON chains, places, evidence, place_status, chain_hints, import_runs, devices
      TO amexbutikker_app
    `.execute(db);
    await sql`REVOKE UPDATE, DELETE, TRUNCATE ON evidence FROM amexbutikker_app`.execute(db);
  }

  public async down(db: Kysely<unknown>): Promise<void> {
    await sql`
      REVOKE ALL ON chains, places, evidence, place_status, chain_hints, import_runs, devices
      FROM amexbutikker_app
    `.execute(db);
    await sql`REVOKE USAGE ON SCHEMA public FROM amexbutikker_app`.execute(db);
  }
}
