import { TrigramNameSimilarity } from '@amexbutikker/domain';
import { CompiledQuery, Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CompositionRoot, DEFAULT_RATE_LIMITS } from '../../src/composition-root.js';
import { PgPlaceRepository } from '../../src/places/pg-place.repository.js';
import type { Database } from '../../src/shared/database.model.js';
import { PgDatabaseErrorTranslator } from '../../src/shared/pg-database-error.translator.js';
import { PostgresTestDatabase } from '../shared/postgres-test.database.js';

// Performance check for the two hot read paths. Run with `pnpm test:perf`; skipped by `pnpm test`.
// Seeds a throwaway container, so it never touches the dev database.
//
// The PostGIS image is amd64 only. On an arm64 machine it runs emulated, measured ~30x slower
// than native, so the latency budget is only enforced when Postgres runs natively (as in CI).
// The query plan checks run everywhere.

const PLACE_COUNT = 50_000;
const P95_BUDGET_MS = 100;

const BRANDS = [
  'Rema 1000',
  'Kiwi',
  'Coop Extra',
  'Meny',
  'Narvesen',
  '7-Eleven',
  'Deli de Luca',
  'Peppes Pizza',
  'Burger King',
  'Vinmonopolet',
  'Apotek 1',
  'Clas Ohlson',
  'Søstrene Grene',
  'Bunnpris',
  'Joker',
  'Espresso House',
  'Kaffebrenneriet',
  'Baker Hansen',
  'Kafé',
  'Restaurant',
  'Bar',
  'Sushi',
  'Thai',
  'Kebab',
  'Blomster',
];
const AREAS = [
  'Grønland',
  'Majorstuen',
  'Frogner',
  'Grünerløkka',
  'Sentrum',
  'Storo',
  'Bislett',
  'Tøyen',
  'Sagene',
  'Skøyen',
  'Bjørvika',
  'Aker Brygge',
  'Torshov',
  'Ullevål',
  'Nydalen',
  'Lambertseter',
  'Bryn',
  'Helsfyr',
  'Røa',
  'Vinderen',
];
const QUERIES = [
  'rema gronland',
  'kafe',
  'espresso house majorstuen',
  'apotek 1',
  'deli de luca storo',
  'sushi',
  'grunerlokka',
  'kiwi 12',
];

const database = new PostgresTestDatabase();
let root: CompositionRoot;
let emulated = false;

beforeAll(async () => {
  await database.start();
  // setseed only applies to its own session, so seed on one connection for repeatable data.
  await database.db.connection().execute(async (connection) => {
    await sql`SELECT setseed(0.42)`.execute(connection);
    await sql`
      INSERT INTO places (id, kind, name, category, street, postcode, city, geom, osm_ref, created_at)
      SELECT
        gen_random_uuid(), 'physical',
        (${BRANDS}::text[])[1 + floor(random() * ${BRANDS.length})::int] || ' ' ||
          (${AREAS}::text[])[1 + floor(random() * ${AREAS.length})::int] ||
          CASE WHEN random() < 0.5 THEN ' ' || (1 + floor(random() * 40))::int ELSE '' END,
        (ARRAY['restaurant','cafe','bar','pub','fast_food','shop','hotel'])[1 + floor(random() * 7)::int],
        'Testgata ' || n, lpad((150 + floor(random() * 1200))::int::text, 4, '0'), 'Oslo',
        ST_SetSRID(ST_MakePoint(10.60 + random() * 0.35, 59.85 + random() * 0.15), 4326)::geography,
        'node/' || (90000000000 + n), now()
      FROM generate_series(1, ${PLACE_COUNT}) AS n
    `.execute(connection);
    // One distinctive name, so the plan check below has a selective query to look at.
    await sql`
      INSERT INTO places (id, kind, name, category, city, geom, osm_ref, created_at)
      VALUES (gen_random_uuid(), 'physical', 'Fjellstua Holmenkollen', 'restaurant', 'Oslo',
        ST_SetSRID(ST_MakePoint(10.67, 59.96), 4326)::geography, 'node/89999999999', now())
    `.execute(connection);
    // A third of the places have a calculated status, as after a while in production.
    await sql`
      INSERT INTO place_status (place_id, status, confidence, basis, verified, last_evidence_at, calculated_at)
      SELECT id, 'accepted', 0.8, 'user_report', false, now(), now()
      FROM places WHERE random() < 0.33
    `.execute(connection);
  });
  await sql`ANALYZE`.execute(database.db);
  const { rows } = await sql<{ version: string }>`SELECT version()`.execute(database.db);
  emulated = process.arch === 'arm64' && rows[0]?.version.includes('x86_64') === true;
  root = new CompositionRoot({
    storage: 'postgres',
    databaseUrl: database.connectionUri,
    deviceTokenSecret: 'perf-secret-that-is-at-least-32-characters',
    host: '127.0.0.1',
    port: 0,
    logLevel: 'silent',
    trustProxy: false,
    rateLimits: DEFAULT_RATE_LIMITS,
  });
}, 600_000);

afterAll(async () => {
  await root.close();
  await database.stop();
});

/** A deterministic spread of points over Oslo. */
function point(i: number): { lat: number; lng: number } {
  return {
    lat: 59.85 + (((i * 7919) % 1000) / 1000) * 0.15,
    lng: 10.6 + (((i * 104729) % 1000) / 1000) * 0.35,
  };
}

const urls: Record<'search' | 'nearby', (i: number) => string> = {
  search: (i) => {
    const q = encodeURIComponent(QUERIES[i % QUERIES.length] ?? 'kafe');
    const { lat, lng } = point(i);
    return i % 2 === 0
      ? `/v1/places/search?q=${q}`
      : `/v1/places/search?q=${q}&lat=${String(lat)}&lng=${String(lng)}`;
  },
  nearby: (i) => {
    const { lat, lng } = point(i);
    const radiusM = [300, 1000, 2000][i % 3] ?? 1000;
    return `/v1/places/nearby?lat=${String(lat)}&lng=${String(lng)}&radiusM=${String(radiusM)}`;
  },
};

function percentile(sorted: readonly number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? NaN;
}

/** Runs the repository call and returns the EXPLAIN ANALYZE plan of the SQL it sent. */
async function planOf(call: (places: PgPlaceRepository) => Promise<unknown>): Promise<string> {
  const queries: CompiledQuery[] = [];
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: database.connectionUri, max: 1 }),
    }),
    log: (event) => {
      queries.push(event.query);
    },
  });
  try {
    await call(
      new PgPlaceRepository(db, new TrigramNameSimilarity(), new PgDatabaseErrorTranslator()),
    );
    const [query] = queries;
    if (query === undefined) {
      throw new Error('The repository sent no query.');
    }
    const { rows } = await db.executeQuery<{ 'QUERY PLAN': string }>(
      CompiledQuery.raw(`EXPLAIN (ANALYZE, BUFFERS) ${query.sql}`, [...query.parameters]),
    );
    return rows.map((row) => row['QUERY PLAN']).join('\n');
  } finally {
    await db.destroy();
  }
}

describe(`places read paths with ${String(PLACE_COUNT)} places`, () => {
  for (const name of ['search', 'nearby'] as const) {
    it(`answers ${name} through HTTP with p95 under ${String(P95_BUDGET_MS)} ms`, async (context) => {
      const app = root.httpServer.app();
      const requests = emulated ? 30 : 300;
      const url = urls[name];
      for (let i = 0; i < 20; i += 1) {
        await app.inject({ method: 'GET', url: url(i) });
      }
      const timings: number[] = [];
      for (let i = 0; i < requests; i += 1) {
        const started = performance.now();
        const response = await app.inject({ method: 'GET', url: url(i) });
        timings.push(performance.now() - started);
        expect(response.statusCode, response.body).toBe(200);
      }
      timings.sort((a, b) => a - b);
      const summary = ([50, 95, 100] as const)
        .map((p) => `p${String(p)}=${percentile(timings, p).toFixed(1)} ms`)
        .join(' ');
      console.log(
        `${name}: n=${String(requests)} ${summary}${emulated ? ' (emulated, budget not enforced)' : ''}`,
      );
      if (emulated) {
        context.skip();
      }

      expect(percentile(timings, 95)).toBeLessThan(P95_BUDGET_MS);
    }, 120_000);
  }

  // Broad queries ("kafe") match a few percent of these repetitive names, where a sequential
  // scan is the planner's fair choice. A selective name must go through the trigram index.
  it('searches a selective name through the trigram index, not a sequential scan', async () => {
    const plan = await planOf((places) =>
      places.search({ text: 'fjellstua holmenkollen', near: point(1), limit: 20 }),
    );
    console.log(`EXPLAIN ANALYZE search:\n${plan}`);

    expect(plan).toMatch(/Bitmap Index Scan on places_normalized_name_trgm_idx/);
    expect(plan).not.toMatch(/Seq Scan on places/);
  });

  it('finds nearby places through the spatial index, not a sequential scan', async () => {
    const plan = await planOf((places) =>
      places.nearby({ center: point(1), radiusM: 1000, limit: 50 }),
    );
    console.log(`EXPLAIN ANALYZE nearby:\n${plan}`);

    expect(plan).toMatch(/Index Scan (on|using) places_geom_idx/);
    expect(plan).not.toMatch(/Seq Scan on places/);
  });
});
