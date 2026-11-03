import { describeDeviceWriterContract } from '@amexbutikker/contracts/test-kit';
import { InMemoryDeviceRepository } from '../../src/devices/in-memory-device.repository.js';
import { freshTables } from '../shared/in-memory-test.tables.js';

describeDeviceWriterContract('InMemoryDeviceRepository', () => {
  const { tables } = freshTables();
  return Promise.resolve({ writer: new InMemoryDeviceRepository(tables) });
});
