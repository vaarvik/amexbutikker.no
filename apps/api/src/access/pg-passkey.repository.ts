import { ConflictError, NotFoundError, PasskeySchema } from '@amexbutikker/contracts';
import type { Passkey, PasskeyId, PasskeyReader, PasskeyWriter } from '@amexbutikker/contracts';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../shared/shared.model.js';
import type { DatabaseErrorTranslator } from '../shared/shared.ports.js';

const RowSchema = z.object({
  id: z.string(),
  public_key: z.string(),
  counter: z.coerce.number(),
  transports: z.array(z.string()),
  created_at: z.date(),
});

export class PgPasskeyRepository implements PasskeyReader, PasskeyWriter {
  public constructor(
    private readonly db: Kysely<Database>,
    private readonly errors: DatabaseErrorTranslator,
  ) {}

  public async findById(id: PasskeyId): Promise<Passkey | null> {
    const { rows } = await sql`
      SELECT id, public_key, counter, transports, created_at FROM passkeys WHERE id = ${id}
    `.execute(this.db);
    const [raw] = rows;
    if (raw === undefined) {
      return null;
    }
    const row = RowSchema.parse(raw);
    return PasskeySchema.parse({
      id: row.id,
      publicKey: row.public_key,
      counter: row.counter,
      transports: row.transports,
      createdAt: row.created_at,
    });
  }

  public async create(passkey: Passkey): Promise<void> {
    try {
      await sql`
        INSERT INTO passkeys (id, public_key, counter, transports, created_at)
        VALUES (${passkey.id}, ${passkey.publicKey}, ${passkey.counter},
                ${[...passkey.transports]}::text[], ${passkey.createdAt})
      `.execute(this.db);
    } catch (error) {
      throw this.errors.translate(error, {
        passkeys_pkey: () => new ConflictError('This passkey is already stored.'),
      });
    }
  }

  public async saveCounter(id: PasskeyId, counter: number): Promise<void> {
    const result = await sql`UPDATE passkeys SET counter = ${counter} WHERE id = ${id}`.execute(
      this.db,
    );
    if (result.numAffectedRows === 0n) {
      throw new NotFoundError('Passkey', id);
    }
  }
}
