import { describeUnitOfWorkContract } from '@amexbutikker/contracts/test-kit';
import { InMemoryUnitOfWork } from '../../src/shared/in-memory.unit-of-work.js';
import { freshTables, portsFor } from '../shared/in-memory-test.tables.js';

describeUnitOfWorkContract('InMemoryUnitOfWork', () => {
  const { tables, places } = freshTables();
  return Promise.resolve({ unitOfWork: new InMemoryUnitOfWork(tables, portsFor), places });
});
