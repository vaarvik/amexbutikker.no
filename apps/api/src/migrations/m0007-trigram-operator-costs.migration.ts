import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

const TRIGRAM_OPERATORS = [
  'similarity_op',
  'word_similarity_op',
  'word_similarity_commutator_op',
] as const;

/**
 * pg_trgm declares its match operators at cost 1, as cheap as an integer comparison. Each call
 * builds trigrams, so the planner chose sequential scans over 50 000 places for single-word
 * searches that the GIN index answers four to seven times faster. PostGIS declares geography
 * distance at 100; at 100 the broadest words still scanned, 500 sends every word to the index.
 * An `ALTER EXTENSION pg_trgm UPDATE` resets the costs; rerun this migration then.
 */
export class M0007TrigramOperatorCostsMigration implements Migration {
  public async up(db: Kysely<unknown>): Promise<void> {
    await this.setCost(db, 500);
  }

  public async down(db: Kysely<unknown>): Promise<void> {
    await this.setCost(db, 1);
  }

  private async setCost(db: Kysely<unknown>, cost: number): Promise<void> {
    for (const name of TRIGRAM_OPERATORS) {
      await sql`ALTER FUNCTION ${sql.raw(name)}(text, text) COST ${sql.raw(String(cost))}`.execute(
        db,
      );
    }
  }
}
