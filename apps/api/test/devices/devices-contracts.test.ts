import { describeDeviceWriterContract } from '@amexbutikker/contracts/test-kit';
import { afterAll, beforeAll } from 'vitest';
import { InMemoryDeviceRepository } from '../../src/devices/in-memory/in-memory-device-repository.js';
import { PgDeviceRepository } from '../../src/devices/postgres/pg-device-repository.js';
import { EmptyInMemoryTablesFactory } from '../../src/shared/in-memory/in-memory-tables.js';
import { PgDatabaseErrorTranslator } from '../../src/shared/postgres/database-error-translator.js';
import { PostgresTestDatabase } from '../shared/postgres-test-database.js';

const database = new PostgresTestDatabase();
beforeAll(() => database.start(), 300_000);
afterAll(() => database.stop());

describeDeviceWriterContract('InMemoryDeviceRepository', () =>
  Promise.resolve({
    writer: new InMemoryDeviceRepository(new EmptyInMemoryTablesFactory().create()),
  }),
);

describeDeviceWriterContract('PgDeviceRepository', async () => {
  await database.reset();
  return { writer: new PgDeviceRepository(database.db, new PgDatabaseErrorTranslator()) };
});
