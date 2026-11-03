import { EvidenceSchema, NotFoundError } from '@amexbutikker/contracts';
import type {
  AppendOutcome,
  ChainId,
  Evidence,
  EvidenceReader,
  EvidenceWriter,
  PlaceId,
} from '@amexbutikker/contracts';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../shared/database.model.js';
import type { DatabaseErrorTranslator } from '../shared/pg-database-error.translator.js';

const EvidenceRowSchema = z.object({
  id: z.string(),
  place_id: z.string().nullable(),
  chain_id: z.string().nullable(),
  kind: z.string(),
  result: z.string(),
  source: z.string(),
  source_ref: z.string(),
  observed_at: z.date(),
  imported_at: z.date(),
  user_id: z.string().nullable(),
  note: z.string().nullable(),
});

/** Append-only: this class has no UPDATE or DELETE, and the database refuses them too. */
export class PgEvidenceRepository implements EvidenceReader, EvidenceWriter {
  public constructor(
    private readonly db: Kysely<Database>,
    private readonly errors: DatabaseErrorTranslator,
  ) {}

  public async listForPlace(placeId: PlaceId): Promise<Evidence[]> {
    const { rows } = await sql`
      SELECT * FROM evidence WHERE place_id = ${placeId}
      ORDER BY observed_at DESC, imported_at DESC, id DESC
    `.execute(this.db);
    return rows.map((row) => this.toEvidence(row));
  }

  public async listForChain(chainId: ChainId): Promise<Evidence[]> {
    const { rows } = await sql`
      SELECT * FROM evidence WHERE chain_id = ${chainId}
      ORDER BY observed_at DESC, imported_at DESC, id DESC
    `.execute(this.db);
    return rows.map((row) => this.toEvidence(row));
  }

  public async append(evidence: Evidence): Promise<AppendOutcome> {
    const { target } = evidence;
    const placeId = target.type === 'place' ? target.placeId : null;
    const chainId = target.type === 'chain' ? target.chainId : null;
    try {
      const { rows } = await sql`
        INSERT INTO evidence
          (id, place_id, chain_id, kind, result, source, source_ref, observed_at, imported_at, user_id, note)
        VALUES (${evidence.id}, ${placeId}, ${chainId}, ${evidence.kind}, ${evidence.result}, ${evidence.source},
          ${evidence.sourceRef}, ${evidence.observedAt}, ${evidence.importedAt}, ${evidence.userId}, ${evidence.note})
        ON CONFLICT ON CONSTRAINT evidence_source_ref_unique DO NOTHING
        RETURNING id
      `.execute(this.db);
      return rows.length === 0 ? 'duplicate' : 'appended';
    } catch (error) {
      throw this.errors.translate(error, {
        evidence_place_id_fkey: () => new NotFoundError('Place', placeId ?? ''),
        evidence_chain_id_fkey: () => new NotFoundError('Chain', chainId ?? ''),
      });
    }
  }

  private toEvidence(raw: unknown): Evidence {
    const row = EvidenceRowSchema.parse(raw);
    return EvidenceSchema.parse({
      id: row.id,
      target:
        row.place_id !== null
          ? { type: 'place', placeId: row.place_id }
          : { type: 'chain', chainId: row.chain_id },
      kind: row.kind,
      result: row.result,
      source: row.source,
      sourceRef: row.source_ref,
      observedAt: row.observed_at,
      importedAt: row.imported_at,
      userId: row.user_id,
      note: row.note,
    });
  }
}
