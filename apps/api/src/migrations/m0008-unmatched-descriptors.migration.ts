import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * The review queue for statement descriptors that matched no place. One row per descriptor with
 * the range of days it was seen: no amounts and no statement lines are stored.
 */
export class M0008UnmatchedDescriptorsMigration implements Migration {
  public async up(db: Kysely<unknown>): Promise<void> {
    await sql`
      CREATE TABLE unmatched_descriptors (
        descriptor text PRIMARY KEY CHECK (descriptor <> '' AND descriptor = upper(descriptor)),
        first_seen_on date NOT NULL,
        last_seen_on date NOT NULL CHECK (last_seen_on >= first_seen_on)
      )
    `.execute(db);
    await sql`
      GRANT SELECT, INSERT, UPDATE, DELETE ON unmatched_descriptors TO amexbutikker_app
    `.execute(db);
  }

  public async down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE unmatched_descriptors`.execute(db);
  }
}
