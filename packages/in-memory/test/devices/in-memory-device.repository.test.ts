import {
  describeDeviceReaderContract,
  describeDeviceWriterContract,
} from '@amexbutikker/contracts/test-kit';
import { InMemoryDeviceRepository } from '../../src/devices/in-memory-device.repository.js';
import { freshTables } from '../shared/in-memory-test.tables.js';

function fixture() {
  const { tables } = freshTables();
  const repository = new InMemoryDeviceRepository(tables);
  return Promise.resolve({ writer: repository, reader: repository });
}

describeDeviceWriterContract('InMemoryDeviceRepository', fixture);
describeDeviceReaderContract('InMemoryDeviceRepository', fixture);
