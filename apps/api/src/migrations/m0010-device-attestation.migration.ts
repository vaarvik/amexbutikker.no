import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

const KINDS = sql.raw(
  "'transaction', 'visit_report', 'user_report', 'chain_confirmation', 'external_list', 'checkout_logo'",
);
const KINDS_WITH_UNVERIFIED = sql.raw(
  "'transaction', 'visit_report', 'user_report', 'chain_confirmation', 'unverified_report', 'external_list', 'checkout_logo'",
);

/**
 * Phase 16: devices can be attested (App Attest or Turnstile), and answers from devices that are
 * not are stored as `unverified_report`. The down migration turns those back into user reports,
 * the only kind it knows; that is the one time evidence is changed, with the append-only trigger
 * off for the statement.
 */
export class M0010DeviceAttestationMigration implements Migration {
  public async up(db: Kysely<unknown>): Promise<void> {
    await sql`
      ALTER TABLE devices
        ADD COLUMN attestation_kind text CHECK (attestation_kind IN ('app_attest', 'turnstile')),
        ADD COLUMN attested_at timestamptz,
        ADD COLUMN app_attest_key_id text UNIQUE,
        ADD CONSTRAINT devices_attestation_complete
          CHECK ((attestation_kind IS NULL) = (attested_at IS NULL)),
        ADD CONSTRAINT devices_key_only_for_app_attest
          CHECK (app_attest_key_id IS NULL OR attestation_kind = 'app_attest')
    `.execute(db);
    await this.kinds(db, KINDS_WITH_UNVERIFIED);
  }

  public async down(db: Kysely<unknown>): Promise<void> {
    await sql`ALTER TABLE evidence DISABLE TRIGGER evidence_append_only`.execute(db);
    await sql`UPDATE evidence SET kind = 'user_report' WHERE kind = 'unverified_report'`.execute(
      db,
    );
    await sql`ALTER TABLE evidence ENABLE TRIGGER evidence_append_only`.execute(db);
    await sql`UPDATE place_status SET basis = 'user_report' WHERE basis = 'unverified_report'`.execute(
      db,
    );
    await this.kinds(db, KINDS);
    await sql`
      ALTER TABLE devices
        DROP CONSTRAINT devices_key_only_for_app_attest,
        DROP CONSTRAINT devices_attestation_complete,
        DROP COLUMN app_attest_key_id,
        DROP COLUMN attested_at,
        DROP COLUMN attestation_kind
    `.execute(db);
  }

  private async kinds(db: Kysely<unknown>, kinds: ReturnType<typeof sql.raw>): Promise<void> {
    await sql`ALTER TABLE evidence DROP CONSTRAINT evidence_kind_check`.execute(db);
    await sql`ALTER TABLE evidence ADD CONSTRAINT evidence_kind_check CHECK (kind IN (${kinds}))`.execute(
      db,
    );
    await sql`ALTER TABLE place_status DROP CONSTRAINT place_status_basis_check`.execute(db);
    await sql`
      ALTER TABLE place_status ADD CONSTRAINT place_status_basis_check CHECK (basis IN (${kinds}))
    `.execute(db);
  }
}
