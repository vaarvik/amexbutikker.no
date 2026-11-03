import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

export class M0004StatusImportsDevicesMigration implements Migration {
  public async up(db: Kysely<unknown>): Promise<void> {
    await sql`
      CREATE TABLE place_status (
        place_id uuid PRIMARY KEY REFERENCES places (id),
        status text NOT NULL CHECK (status IN ('accepted', 'rejected', 'mixed', 'unknown')),
        confidence double precision NOT NULL CHECK (confidence BETWEEN 0 AND 1),
        basis text CHECK (basis IN
          ('transaction', 'visit_report', 'user_report', 'chain_confirmation', 'external_list', 'checkout_logo')),
        verified boolean NOT NULL,
        last_evidence_at timestamptz,
        calculated_at timestamptz NOT NULL
      )
    `.execute(db);
    await sql`
      CREATE TABLE chain_hints (
        chain_id uuid PRIMARY KEY REFERENCES chains (id),
        accepted_count integer NOT NULL CHECK (accepted_count >= 0),
        total_with_evidence integer NOT NULL CHECK (total_with_evidence >= accepted_count),
        calculated_at timestamptz NOT NULL
      )
    `.execute(db);
    await sql`
      CREATE TABLE import_runs (
        id uuid PRIMARY KEY,
        source text NOT NULL,
        dry_run boolean NOT NULL,
        started_at timestamptz NOT NULL,
        finished_at timestamptz,
        status text CHECK (status IN ('succeeded', 'failed')),
        fetched_at timestamptz,
        counts jsonb,
        metrics jsonb,
        messages jsonb,
        CONSTRAINT import_runs_finished_shape CHECK ((finished_at IS NULL) = (status IS NULL))
      )
    `.execute(db);
    await sql`
      CREATE TABLE devices (
        user_id uuid PRIMARY KEY,
        platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `.execute(db);
  }

  public async down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE devices`.execute(db);
    await sql`DROP TABLE import_runs`.execute(db);
    await sql`DROP TABLE chain_hints`.execute(db);
    await sql`DROP TABLE place_status`.execute(db);
  }
}
