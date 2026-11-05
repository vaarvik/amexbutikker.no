import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/**
 * Adds likely_accepted and likely_rejected: the answer until users have confirmed it. Stored
 * statuses keep their value until their place is recalculated; the down migration folds the
 * likely values back into accepted and rejected.
 */
export class M0009LikelyStatusesMigration implements Migration {
  public async up(db: Kysely<unknown>): Promise<void> {
    await sql`ALTER TABLE place_status DROP CONSTRAINT place_status_status_check`.execute(db);
    await sql`
      ALTER TABLE place_status ADD CONSTRAINT place_status_status_check CHECK (status IN
        ('accepted', 'likely_accepted', 'rejected', 'likely_rejected', 'mixed', 'unknown'))
    `.execute(db);
  }

  public async down(db: Kysely<unknown>): Promise<void> {
    await sql`
      UPDATE place_status SET status = CASE status
        WHEN 'likely_accepted' THEN 'accepted'
        WHEN 'likely_rejected' THEN 'rejected'
        ELSE status END
    `.execute(db);
    await sql`ALTER TABLE place_status DROP CONSTRAINT place_status_status_check`.execute(db);
    await sql`
      ALTER TABLE place_status ADD CONSTRAINT place_status_status_check CHECK (status IN
        ('accepted', 'rejected', 'mixed', 'unknown'))
    `.execute(db);
  }
}
