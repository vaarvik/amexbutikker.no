import {
  ConflictError,
  HouseholdIdSchema,
  NotFoundError,
  UserIdSchema,
} from '@amexbutikker/contracts';
import type {
  Household,
  HouseholdId,
  HouseholdMembership,
  HouseholdReader,
  HouseholdRecord,
  HouseholdWriter,
  NewHouseholdRecord,
  UserId,
} from '@amexbutikker/contracts';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../shared/shared.model.js';
import type { DatabaseErrorTranslator } from '../shared/shared.ports.js';

const HouseholdRowSchema = z.object({
  id: HouseholdIdSchema,
  join_token_hash: z.string(),
  created_at: z.date(),
});

const MemberRowSchema = z.object({
  household_id: HouseholdIdSchema,
  user_id: UserIdSchema,
  joined_at: z.date(),
  left_at: z.date().nullable(),
});

const RecordRowSchema = z.object({
  // bigint arrives as text.
  seq: z.coerce.number().int().positive(),
  household_id: HouseholdIdSchema,
  author_id: UserIdSchema,
  sealed: z.string(),
  created_at: z.date(),
});

export class PgHouseholdRepository implements HouseholdReader, HouseholdWriter {
  public constructor(
    private readonly db: Kysely<Database>,
    private readonly errors: DatabaseErrorTranslator,
  ) {}

  public async create(household: Household): Promise<void> {
    try {
      await sql`
        INSERT INTO households (id, join_token_hash, created_at)
        VALUES (${household.id}, ${household.joinTokenHash}, ${household.createdAt})
      `.execute(this.db);
    } catch (error) {
      throw this.errors.translate(error, {
        households_pkey: () => new ConflictError(`Household ${household.id} exists.`),
      });
    }
  }

  public async saveMembership(membership: HouseholdMembership): Promise<void> {
    try {
      await sql`
        INSERT INTO household_members (user_id, household_id, joined_at, left_at)
        VALUES (${membership.userId}, ${membership.householdId}, ${membership.joinedAt}, ${membership.leftAt})
        ON CONFLICT (user_id) DO UPDATE
          SET household_id = EXCLUDED.household_id,
              joined_at = EXCLUDED.joined_at,
              left_at = EXCLUDED.left_at
      `.execute(this.db);
    } catch (error) {
      throw this.errors.translate(error, {
        household_members_household_id_fkey: () =>
          new NotFoundError('Household', membership.householdId),
      });
    }
  }

  public async appendRecords(records: readonly NewHouseholdRecord[]): Promise<HouseholdRecord[]> {
    if (records.length === 0) {
      return [];
    }
    const values = records.map(
      (record) =>
        sql`(${record.householdId}, ${record.authorId}, ${record.sealed}, ${record.createdAt})`,
    );
    // Identity values follow the VALUES order within one INSERT; ORDER BY seq keeps it.
    const { rows } = await sql`
      INSERT INTO household_records (household_id, author_id, sealed, created_at)
      VALUES ${sql.join(values)}
      RETURNING seq, household_id, author_id, sealed, created_at
    `.execute(this.db);
    return rows.map((row) => this.record(row)).sort((a, b) => a.seq - b.seq);
  }

  public async findById(id: HouseholdId): Promise<Household | null> {
    const { rows } = await sql`
      SELECT id, join_token_hash, created_at FROM households WHERE id = ${id}
    `.execute(this.db);
    const [raw] = rows;
    if (raw === undefined) {
      return null;
    }
    const row = HouseholdRowSchema.parse(raw);
    return { id: row.id, joinTokenHash: row.join_token_hash, createdAt: row.created_at };
  }

  public async findMembership(userId: UserId): Promise<HouseholdMembership | null> {
    const { rows } = await sql`
      SELECT household_id, user_id, joined_at, left_at FROM household_members
      WHERE user_id = ${userId} AND left_at IS NULL
    `.execute(this.db);
    const [raw] = rows;
    return raw === undefined ? null : this.member(raw);
  }

  public async listMembers(id: HouseholdId): Promise<HouseholdMembership[]> {
    const { rows } = await sql`
      SELECT household_id, user_id, joined_at, left_at FROM household_members
      WHERE household_id = ${id} AND left_at IS NULL
      ORDER BY joined_at, user_id
    `.execute(this.db);
    return rows.map((row) => this.member(row));
  }

  public async listRecords(
    id: HouseholdId,
    afterSeq: number,
    limit: number,
  ): Promise<HouseholdRecord[]> {
    const { rows } = await sql`
      SELECT seq, household_id, author_id, sealed, created_at FROM household_records
      WHERE household_id = ${id} AND seq > ${afterSeq}
      ORDER BY seq
      LIMIT ${limit}
    `.execute(this.db);
    return rows.map((row) => this.record(row));
  }

  private member(raw: unknown): HouseholdMembership {
    const row = MemberRowSchema.parse(raw);
    return {
      householdId: row.household_id,
      userId: row.user_id,
      joinedAt: row.joined_at,
      leftAt: row.left_at,
    };
  }

  private record(raw: unknown): HouseholdRecord {
    const row = RecordRowSchema.parse(raw);
    return {
      seq: row.seq,
      householdId: row.household_id,
      authorId: row.author_id,
      sealed: row.sealed,
      createdAt: row.created_at,
    };
  }
}
