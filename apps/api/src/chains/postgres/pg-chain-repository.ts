import {
  ChainHintSchema,
  ChainSchema,
  ConflictError,
  NotFoundError,
} from '@amexbutikker/contracts';
import type {
  Chain,
  ChainHint,
  ChainId,
  ChainReader,
  ChainSourceRecord,
  ChainUpsertResult,
  ChainWriter,
} from '@amexbutikker/contracts';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../../shared/postgres/database.js';
import type { DatabaseErrorTranslator } from '../../shared/postgres/database-error-translator.js';

const ChainRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand_wikidata: z.string().nullable(),
  created_at: z.date(),
});

const ChainHintRowSchema = z.object({
  chain_id: z.string(),
  accepted_count: z.number(),
  total_with_evidence: z.number(),
  calculated_at: z.date(),
});

export class PgChainRepository implements ChainReader, ChainWriter {
  public constructor(
    private readonly db: Kysely<Database>,
    private readonly errors: DatabaseErrorTranslator,
  ) {}

  public async getById(id: ChainId): Promise<Chain> {
    const { rows } = await sql`SELECT * FROM chains WHERE id = ${id}`.execute(this.db);
    const [row] = rows;
    if (row === undefined) {
      throw new NotFoundError('Chain', id);
    }
    return this.toChain(row);
  }

  public async findByName(name: string): Promise<Chain | null> {
    const { rows } = await sql`
      SELECT * FROM chains WHERE f_normalize_name(name) = f_normalize_name(${name})
      ORDER BY created_at ASC, id ASC LIMIT 1
    `.execute(this.db);
    const [row] = rows;
    return row === undefined ? null : this.toChain(row);
  }

  public async getHint(chainId: ChainId): Promise<ChainHint | null> {
    const { rows } = await sql`SELECT * FROM chain_hints WHERE chain_id = ${chainId}`.execute(
      this.db,
    );
    const [row] = rows;
    if (row === undefined) {
      return null;
    }
    const hint = ChainHintRowSchema.parse(row);
    return ChainHintSchema.parse({
      chainId: hint.chain_id,
      acceptedCount: hint.accepted_count,
      totalWithEvidence: hint.total_with_evidence,
      calculatedAt: hint.calculated_at,
    });
  }

  public async create(chain: Chain): Promise<void> {
    try {
      await sql`
        INSERT INTO chains (id, name, brand_wikidata, created_at)
        VALUES (${chain.id}, ${chain.name}, ${chain.brandWikidata}, ${chain.createdAt})
      `.execute(this.db);
    } catch (error) {
      throw this.errors.translate(error, {
        chains_pkey: () => new ConflictError(`Chain ${chain.id} already exists.`),
        chains_brand_wikidata_key: () =>
          new ConflictError(`brandWikidata ${chain.brandWikidata ?? ''} is already taken.`),
      });
    }
  }

  public async upsertFromSource(
    record: ChainSourceRecord,
    newId: ChainId,
  ): Promise<ChainUpsertResult> {
    if (record.brandWikidata !== null) {
      const { rows } = await sql`
        INSERT INTO chains (id, name, brand_wikidata) VALUES (${newId}, ${record.name}, ${record.brandWikidata})
        ON CONFLICT (brand_wikidata) DO UPDATE SET name = EXCLUDED.name
        WHERE chains.name IS DISTINCT FROM EXCLUDED.name
        RETURNING id, (xmax = 0) AS inserted
      `.execute(this.db);
      const [row] = rows;
      if (row !== undefined) {
        const { id, inserted } = z.object({ id: z.string(), inserted: z.boolean() }).parse(row);
        return { chainId: id as ChainId, outcome: inserted ? 'created' : 'updated' };
      }
      const existing = await sql`
        SELECT id FROM chains WHERE brand_wikidata = ${record.brandWikidata}
      `.execute(this.db);
      return {
        chainId: z.object({ id: z.string() }).parse(existing.rows[0]).id as ChainId,
        outcome: 'unchanged',
      };
    }

    const existing = await this.findByName(record.name);
    if (existing === null) {
      await sql`INSERT INTO chains (id, name) VALUES (${newId}, ${record.name})`.execute(this.db);
      return { chainId: newId, outcome: 'created' };
    }
    if (existing.name === record.name) {
      return { chainId: existing.id, outcome: 'unchanged' };
    }
    await sql`UPDATE chains SET name = ${record.name} WHERE id = ${existing.id}`.execute(this.db);
    return { chainId: existing.id, outcome: 'updated' };
  }

  public async saveHint(hint: ChainHint): Promise<void> {
    try {
      await sql`
        INSERT INTO chain_hints (chain_id, accepted_count, total_with_evidence, calculated_at)
        VALUES (${hint.chainId}, ${hint.acceptedCount}, ${hint.totalWithEvidence}, ${hint.calculatedAt})
        ON CONFLICT (chain_id) DO UPDATE SET
          accepted_count = EXCLUDED.accepted_count,
          total_with_evidence = EXCLUDED.total_with_evidence,
          calculated_at = EXCLUDED.calculated_at
      `.execute(this.db);
    } catch (error) {
      throw this.errors.translate(error, {
        chain_hints_chain_id_fkey: () => new NotFoundError('Chain', hint.chainId),
      });
    }
  }

  private toChain(raw: unknown): Chain {
    const row = ChainRowSchema.parse(raw);
    return ChainSchema.parse({
      id: row.id,
      name: row.name,
      brandWikidata: row.brand_wikidata,
      createdAt: row.created_at,
    });
  }
}
