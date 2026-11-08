import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * Households: phones that share Bonus spending. The server keeps only sealed records it cannot
 * read (docs/adr/0002-household-sync.md), a hash of the join token and who is a member. One
 * membership row per device: its current household, or the last one it left. Records are
 * append-only for the API role.
 */
export class M0011HouseholdsMigration implements Migration {
  public async up(db: Kysely<unknown>): Promise<void> {
    await sql`
      CREATE TABLE households (
        id uuid PRIMARY KEY,
        join_token_hash text NOT NULL CHECK (join_token_hash ~ '^[0-9a-f]{64}$'),
        created_at timestamptz NOT NULL
      )
    `.execute(db);
    await sql`
      CREATE TABLE household_members (
        user_id uuid PRIMARY KEY REFERENCES devices (user_id) ON DELETE CASCADE,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        joined_at timestamptz NOT NULL,
        left_at timestamptz CHECK (left_at IS NULL OR left_at >= joined_at)
      )
    `.execute(db);
    await sql`
      CREATE INDEX household_members_current ON household_members (household_id)
        WHERE left_at IS NULL
    `.execute(db);
    await sql`
      CREATE TABLE household_records (
        seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        author_id uuid NOT NULL,
        sealed text NOT NULL CHECK (length(sealed) BETWEEN 1 AND 8192),
        created_at timestamptz NOT NULL
      )
    `.execute(db);
    await sql`
      CREATE INDEX household_records_by_household ON household_records (household_id, seq)
    `.execute(db);
    await sql`
      GRANT SELECT, INSERT, UPDATE ON households, household_members TO amexbutikker_app
    `.execute(db);
    await sql`GRANT SELECT, INSERT ON household_records TO amexbutikker_app`.execute(db);
  }

  public async down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE household_records`.execute(db);
    await sql`DROP TABLE household_members`.execute(db);
    await sql`DROP TABLE households`.execute(db);
  }
}
