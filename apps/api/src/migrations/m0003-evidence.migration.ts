import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** Append-only evidence. A trigger refuses UPDATE and DELETE for every role, including the owner. */
export class M0003EvidenceMigration implements Migration {
  public async up(db: Kysely<unknown>): Promise<void> {
    await sql`
      CREATE TABLE evidence (
        id uuid PRIMARY KEY,
        place_id uuid REFERENCES places (id),
        chain_id uuid REFERENCES chains (id),
        kind text NOT NULL CHECK (kind IN
          ('transaction', 'visit_report', 'user_report', 'chain_confirmation', 'external_list', 'checkout_logo')),
        result text NOT NULL CHECK (result IN ('accepted', 'rejected', 'withdrawn')),
        source text NOT NULL CHECK (length(btrim(source)) > 0),
        source_ref text NOT NULL CHECK (length(btrim(source_ref)) > 0),
        observed_at timestamptz NOT NULL,
        imported_at timestamptz NOT NULL,
        user_id uuid,
        note text CHECK (length(note) <= 500),
        CONSTRAINT evidence_has_target CHECK (place_id IS NOT NULL OR chain_id IS NOT NULL),
        CONSTRAINT evidence_single_target CHECK (place_id IS NULL OR chain_id IS NULL),
        CONSTRAINT evidence_withdrawn_needs_user CHECK (result <> 'withdrawn' OR user_id IS NOT NULL),
        CONSTRAINT evidence_source_ref_unique UNIQUE (source, source_ref)
      )
    `.execute(db);
    await sql`CREATE INDEX evidence_place_observed_idx ON evidence (place_id, observed_at DESC) WHERE place_id IS NOT NULL`.execute(
      db,
    );
    await sql`CREATE INDEX evidence_chain_observed_idx ON evidence (chain_id, observed_at DESC) WHERE chain_id IS NOT NULL`.execute(
      db,
    );
    await sql`
      CREATE INDEX evidence_user_place_latest_idx ON evidence (user_id, place_id, observed_at DESC, imported_at DESC)
      WHERE user_id IS NOT NULL
    `.execute(db);
    await sql`
      CREATE FUNCTION evidence_is_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'evidence is append-only: % is not allowed', TG_OP USING ERRCODE = 'restrict_violation';
      END
      $$
    `.execute(db);
    await sql`
      CREATE TRIGGER evidence_append_only BEFORE UPDATE OR DELETE ON evidence
      FOR EACH ROW EXECUTE FUNCTION evidence_is_append_only()
    `.execute(db);
  }

  public async down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE evidence`.execute(db);
    await sql`DROP FUNCTION evidence_is_append_only()`.execute(db);
  }
}
