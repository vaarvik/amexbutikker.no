import type { TransactionalPorts } from '@amexbutikker/contracts';
import {
  describeChainReaderContract,
  describeChainWriterContract,
  describeDeviceWriterContract,
  describeEvidenceContract,
  describeImportRunWriterContract,
  describePlaceReaderContract,
  describePlaceStatusContract,
  describePlaceWriterContract,
  describeUnitOfWorkContract,
  describeUnmatchedDescriptorContract,
} from '@amexbutikker/contracts/test-kit';
import { TrigramNameSimilarity } from '@amexbutikker/domain';
import type { Kysely } from 'kysely';
import { afterAll, beforeAll } from 'vitest';
import { PgChainRepository } from '../../src/chains/pg-chain.repository.js';
import { PgDeviceRepository } from '../../src/devices/pg-device.repository.js';
import { PgEvidenceRepository } from '../../src/evidence/pg-evidence.repository.js';
import { PgImportRunRepository } from '../../src/imports/pg-import-run.repository.js';
import { PgUnmatchedDescriptorRepository } from '../../src/imports/pg-unmatched-descriptor.repository.js';
import { PgPlaceRepository } from '../../src/places/pg-place.repository.js';
import type { Database } from '../../src/shared/shared.model.js';
import { PgDatabaseErrorTranslator } from '../../src/shared/pg-database-error.translator.js';
import { PgUnitOfWork } from '../../src/shared/pg.unit-of-work.js';
import { PgPlaceStatusRepository } from '../../src/status/pg-place-status.repository.js';
import { PostgresTestDatabase } from './postgres-test.database.js';

const database = new PostgresTestDatabase();
const errors = new PgDatabaseErrorTranslator();
const names = new TrigramNameSimilarity();

beforeAll(() => database.start(), 300_000);
afterAll(() => database.stop());

function portsFor(db: Kysely<Database>): TransactionalPorts {
  return {
    places: new PgPlaceRepository(db, names, errors),
    chains: new PgChainRepository(db, errors),
    evidence: new PgEvidenceRepository(db, errors),
    statuses: new PgPlaceStatusRepository(db, errors),
  };
}

async function fresh() {
  await database.reset();
  return portsFor(database.db);
}

describePlaceReaderContract('PgPlaceRepository', async () => {
  const { places, chains } = await fresh();
  return { reader: places, writer: places, chains };
});

describePlaceWriterContract('PgPlaceRepository', async () => {
  const { places } = await fresh();
  return { writer: places, reader: places };
});

describeChainReaderContract('PgChainRepository', async () => {
  const { chains } = await fresh();
  return { reader: chains, writer: chains };
});

describeChainWriterContract('PgChainRepository', async () => {
  const { chains } = await fresh();
  return { writer: chains, reader: chains };
});

describeEvidenceContract('PgEvidenceRepository', async () => {
  const { evidence, places, chains } = await fresh();
  return { reader: evidence, writer: evidence, places, chains };
});

describePlaceStatusContract('PgPlaceStatusRepository', async () => {
  const { statuses, places, chains } = await fresh();
  return { reader: statuses, writer: statuses, places, chains };
});

describeImportRunWriterContract('PgImportRunRepository', async () => {
  await database.reset();
  return { writer: new PgImportRunRepository(database.db, errors) };
});

describeUnmatchedDescriptorContract('PgUnmatchedDescriptorRepository', async () => {
  await database.reset();
  const repository = new PgUnmatchedDescriptorRepository(database.db);
  return { writer: repository, reader: repository };
});

describeUnitOfWorkContract('PgUnitOfWork', async () => {
  const { places } = await fresh();
  return { unitOfWork: new PgUnitOfWork(database.db, portsFor, errors), places };
});

describeDeviceWriterContract('PgDeviceRepository', async () => {
  await database.reset();
  return { writer: new PgDeviceRepository(database.db, errors) };
});
