import { TestData } from '@amexbutikker/contracts/test-kit';
import { TrigramNameSimilarity } from '@amexbutikker/domain';
import { sql } from 'kysely';
import { NO_MIGRATIONS } from 'kysely/migration';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PgEvidenceRepository } from '../../src/evidence/pg-evidence.repository.js';
import { PgPlaceRepository } from '../../src/places/pg-place.repository.js';
import { PgDatabaseErrorTranslator } from '../../src/shared/pg-database-error.translator.js';
import { PostgresTestDatabase } from '../shared/postgres-test.database.js';

const database = new PostgresTestDatabase();
const errors = new PgDatabaseErrorTranslator();

beforeAll(() => database.start(), 300_000);
afterAll(() => database.stop());
beforeEach(() => database.reset());

async function seedEvidence() {
  const data = new TestData();
  const place = data.physicalPlace();
  await new PgPlaceRepository(database.db, new TrigramNameSimilarity(), errors).create(place);
  const evidence = data.evidence({ target: { type: 'place', placeId: place.id } });
  await new PgEvidenceRepository(database.db, errors).append(evidence);
  return evidence;
}

describe('Postgres schema', () => {
  it('migrates all the way down and back up', async () => {
    const migrator = database.migrator();

    const down = await migrator.migrateTo(NO_MIGRATIONS);
    expect(down.error).toBeUndefined();
    const { rows } = await sql<{ count: string }>`
      SELECT count(*)::text AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('places', 'chains', 'evidence', 'place_status')
    `.execute(database.db);
    expect(rows[0]?.count).toBe('0');

    const up = await migrator.migrateToLatest();
    expect(up.error).toBeUndefined();
    expect(up.results?.every((result) => result.status === 'Success')).toBe(true);
    // The PostGIS image runs emulated on arm64; a full round trip can take well over 5 s.
  }, 60_000);

  it('refuses UPDATE and DELETE on evidence, even for the owner', async () => {
    const evidence = await seedEvidence();

    await expect(
      sql`UPDATE evidence SET note = 'changed' WHERE id = ${evidence.id}`.execute(database.db),
    ).rejects.toThrow(/append-only/);
    await expect(
      sql`DELETE FROM evidence WHERE id = ${evidence.id}`.execute(database.db),
    ).rejects.toThrow(/append-only/);
  });

  it('does not grant UPDATE, DELETE or TRUNCATE on evidence to the application role', async () => {
    const { rows } = await sql<{ privilege_type: string }>`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE grantee = 'amexbutikker_app' AND table_name = 'evidence'
      ORDER BY privilege_type
    `.execute(database.db);

    expect(rows.map((row) => row.privilege_type)).toEqual(['INSERT', 'SELECT']);
  });

  it('stores the normalised name and indexes it for trigram search', async () => {
    const { rows } = await sql<{ indexdef: string }>`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'places_normalized_name_trgm_idx'
    `.execute(database.db);
    expect(rows[0]?.indexdef).toContain('normalized_name gin_trgm_ops');

    const place = new TestData().physicalPlace({ name: 'Kafé Åsen  Bakeri' });
    await new PgPlaceRepository(database.db, new TrigramNameSimilarity(), errors).create(place);
    const stored = await sql<{ normalized_name: string }>`
      SELECT normalized_name FROM places WHERE id = ${place.id}
    `.execute(database.db);
    expect(stored.rows[0]?.normalized_name).toBe(new TrigramNameSimilarity().normalize(place.name));
  });

  it('costs the trigram match operators so the planner prefers the index', async () => {
    const { rows } = await sql<{ proname: string; procost: number }>`
      SELECT proname, procost FROM pg_proc
      WHERE proname IN ('similarity_op', 'word_similarity_op', 'word_similarity_commutator_op')
      ORDER BY proname
    `.execute(database.db);

    expect(rows.map((row) => [row.proname, row.procost])).toEqual([
      ['similarity_op', 500],
      ['word_similarity_commutator_op', 500],
      ['word_similarity_op', 500],
    ]);
  });

  it('normalises names the same way as the domain', async () => {
    const names = new TrigramNameSimilarity();
    const inputs = [
      'Kafé Åsen',
      '  Grønland   Torg ',
      'Bjørn Ærlig',
      'Crème Brûlée',
      'Søstrene GRENE',
    ];

    for (const input of inputs) {
      const { rows } = await sql<{
        value: string;
      }>`SELECT f_normalize_name(${input}) AS value`.execute(database.db);
      expect(rows[0]?.value).toBe(names.normalize(input));
    }
  });

  it('computes the same trigram similarity as the domain', async () => {
    const names = new TrigramNameSimilarity();
    const pairs: [string, string][] = [
      ['word', 'two words'],
      ['Rema 1000 Grønland', 'Remake Studio'],
      ['kafe asen', 'Kafé Åsen'],
    ];

    for (const [a, b] of pairs) {
      const { rows } = await sql<{ value: number }>`
        SELECT similarity(f_normalize_name(${a}), f_normalize_name(${b}))::float8 AS value
      `.execute(database.db);
      expect(rows[0]?.value).toBeCloseTo(names.similarity(a, b), 5);
    }
  });
});
