import { describeUnmatchedDescriptorContract } from '@amexbutikker/contracts/test-kit';
import { InMemoryUnmatchedDescriptorRepository } from '../../src/imports/in-memory-unmatched-descriptor.repository.js';
import { freshTables } from '../shared/in-memory-test.tables.js';

describeUnmatchedDescriptorContract('InMemoryUnmatchedDescriptorRepository', () => {
  const repository = new InMemoryUnmatchedDescriptorRepository(freshTables().tables);
  return Promise.resolve({ writer: repository, reader: repository });
});
