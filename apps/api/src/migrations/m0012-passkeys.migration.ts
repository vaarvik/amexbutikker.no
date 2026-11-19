import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** The passkeys that may open a private deployment (docs/hosting.md). Public keys only. */
export class M0012PasskeysMigration implements Migration {
  public async up(db: Kysely<unknown>): Promise<void> {
    await sql`
      CREATE TABLE passkeys (
        id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]+$'),
        public_key text NOT NULL CHECK (public_key ~ '^[A-Za-z0-9_-]+$'),
        counter bigint NOT NULL CHECK (counter >= 0),
        transports text[] NOT NULL,
        created_at timestamptz NOT NULL
      )
    `.execute(db);
    await sql`GRANT SELECT, INSERT, UPDATE ON passkeys TO amexbutikker_app`.execute(db);
  }

  public async down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE passkeys`.execute(db);
  }
}
