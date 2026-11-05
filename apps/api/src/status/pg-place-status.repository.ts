import { NotFoundError, PlaceStatusSnapshotSchema } from '@amexbutikker/contracts';
import type {
  ChainId,
  PlaceId,
  PlaceStatusReader,
  PlaceStatusSnapshot,
  PlaceStatusWriter,
} from '@amexbutikker/contracts';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../shared/shared.model.js';
import type { DatabaseErrorTranslator } from '../shared/pg-database-error.translator.js';

const StatusRowSchema = z.object({
  place_id: z.string(),
  status: z.string(),
  confidence: z.number(),
  basis: z.string().nullable(),
  verified: z.boolean(),
  last_evidence_at: z.date().nullable(),
  calculated_at: z.date(),
});

export class PgPlaceStatusRepository implements PlaceStatusReader, PlaceStatusWriter {
  public constructor(
    private readonly db: Kysely<Database>,
    private readonly errors: DatabaseErrorTranslator,
  ) {}

  public async find(placeId: PlaceId): Promise<PlaceStatusSnapshot | null> {
    const { rows } = await sql`SELECT * FROM place_status WHERE place_id = ${placeId}`.execute(
      this.db,
    );
    const [row] = rows;
    return row === undefined ? null : this.toSnapshot(row);
  }

  public async findMany(
    placeIds: readonly PlaceId[],
  ): Promise<ReadonlyMap<PlaceId, PlaceStatusSnapshot>> {
    if (placeIds.length === 0) {
      return new Map();
    }
    const { rows } = await sql`
      SELECT * FROM place_status WHERE place_id = ANY(${[...placeIds]}::uuid[])
    `.execute(this.db);
    return new Map(
      rows.map((row) => {
        const snapshot = this.toSnapshot(row);
        return [snapshot.placeId, snapshot] as const;
      }),
    );
  }

  public async listForChain(chainId: ChainId): Promise<PlaceStatusSnapshot[]> {
    const { rows } = await sql`
      SELECT s.* FROM place_status s JOIN places p ON p.id = s.place_id WHERE p.chain_id = ${chainId}
    `.execute(this.db);
    return rows.map((row) => this.toSnapshot(row));
  }

  public async save(snapshot: PlaceStatusSnapshot): Promise<void> {
    const { status } = snapshot;
    try {
      await sql`
        INSERT INTO place_status (place_id, status, confidence, basis, verified, last_evidence_at, calculated_at)
        VALUES (${snapshot.placeId}, ${status.status}, ${status.confidence}, ${status.basis}, ${status.verified},
          ${status.lastEvidenceAt}, ${snapshot.calculatedAt})
        ON CONFLICT (place_id) DO UPDATE SET
          status = EXCLUDED.status, confidence = EXCLUDED.confidence, basis = EXCLUDED.basis,
          verified = EXCLUDED.verified, last_evidence_at = EXCLUDED.last_evidence_at,
          calculated_at = EXCLUDED.calculated_at
      `.execute(this.db);
    } catch (error) {
      throw this.errors.translate(error, {
        place_status_place_id_fkey: () => new NotFoundError('Place', snapshot.placeId),
      });
    }
  }

  private toSnapshot(raw: unknown): PlaceStatusSnapshot {
    const row = StatusRowSchema.parse(raw);
    return PlaceStatusSnapshotSchema.parse({
      placeId: row.place_id,
      status: {
        status: row.status,
        confidence: row.confidence,
        basis: row.basis,
        verified: row.verified,
        lastEvidenceAt: row.last_evidence_at,
      },
      calculatedAt: row.calculated_at,
    });
  }
}
