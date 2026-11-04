import type {
  UnmatchedDescriptor,
  UnmatchedDescriptorReader,
  UnmatchedDescriptorWriter,
  UpsertOutcome,
} from '@amexbutikker/contracts';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../shared/database.model.js';

const RowSchema = z.object({
  descriptor: z.string(),
  first_seen_on: z.string(),
  last_seen_on: z.string(),
});

/** Dates travel as `YYYY-MM-DD` text, so the session time zone cannot shift them. */
export class PgUnmatchedDescriptorRepository
  implements UnmatchedDescriptorWriter, UnmatchedDescriptorReader
{
  public constructor(private readonly db: Kysely<Database>) {}

  public async record(descriptor: string, seenOn: Date): Promise<UpsertOutcome> {
    const key = descriptor.trim().replace(/\s+/g, ' ').toUpperCase();
    const day = seenOn.toISOString().slice(0, 10);
    const { rows } = await sql`
      INSERT INTO unmatched_descriptors (descriptor, first_seen_on, last_seen_on)
      VALUES (${key}, ${day}::date, ${day}::date)
      ON CONFLICT (descriptor) DO UPDATE SET
        first_seen_on = LEAST(unmatched_descriptors.first_seen_on, EXCLUDED.first_seen_on),
        last_seen_on = GREATEST(unmatched_descriptors.last_seen_on, EXCLUDED.last_seen_on)
      WHERE EXCLUDED.first_seen_on < unmatched_descriptors.first_seen_on
         OR EXCLUDED.last_seen_on > unmatched_descriptors.last_seen_on
      RETURNING (xmax = 0) AS inserted
    `.execute(this.db);
    const [row] = rows;
    if (row === undefined) {
      return 'unchanged';
    }
    return z.object({ inserted: z.boolean() }).parse(row).inserted ? 'created' : 'updated';
  }

  public async list(): Promise<UnmatchedDescriptor[]> {
    const { rows } = await sql`
      SELECT descriptor, to_char(first_seen_on, 'YYYY-MM-DD') AS first_seen_on,
        to_char(last_seen_on, 'YYYY-MM-DD') AS last_seen_on
      FROM unmatched_descriptors ORDER BY last_seen_on DESC, descriptor COLLATE "C"
    `.execute(this.db);
    return rows.map((raw) => {
      const row = RowSchema.parse(raw);
      return {
        descriptor: row.descriptor,
        firstSeenOn: new Date(`${row.first_seen_on}T00:00:00.000Z`),
        lastSeenOn: new Date(`${row.last_seen_on}T00:00:00.000Z`),
      };
    });
  }
}
