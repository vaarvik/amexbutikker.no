import { describeImportRunWriterContract } from '@amexbutikker/contracts/test-kit';
import { InMemoryImportRunRepository } from '../../src/imports/in-memory-import-run.repository.js';
import { freshTables } from '../shared/in-memory-test.tables.js';

describeImportRunWriterContract('InMemoryImportRunRepository', () => {
  const { tables } = freshTables();
  return Promise.resolve({ writer: new InMemoryImportRunRepository(tables) });
});
