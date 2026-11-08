import {
  describeHouseholdReaderContract,
  describeHouseholdWriterContract,
} from '@amexbutikker/contracts/test-kit';
import { InMemoryDeviceRepository } from '../../src/devices/in-memory-device.repository.js';
import { InMemoryHouseholdRepository } from '../../src/households/in-memory-household.repository.js';
import { freshTables } from '../shared/in-memory-test.tables.js';

function fixture() {
  const { tables } = freshTables();
  const repository = new InMemoryHouseholdRepository(tables);
  return Promise.resolve({
    writer: repository,
    reader: repository,
    devices: new InMemoryDeviceRepository(tables),
  });
}

describeHouseholdWriterContract('InMemoryHouseholdRepository', fixture);
describeHouseholdReaderContract('InMemoryHouseholdRepository', fixture);
