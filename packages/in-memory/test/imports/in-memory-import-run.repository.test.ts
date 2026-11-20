import {
  describeImportRunReaderContract,
  describeImportRunWriterContract,
} from '@amexbutikker/contracts/test-kit';
import { InMemoryImportRunRepository } from '../../src/imports/in-memory-import-run.repository.js';
import { freshTables } from '../shared/in-memory-test.tables.js';

function fixture() {
  const repository = new InMemoryImportRunRepository(freshTables().tables);
  return Promise.resolve({ writer: repository, reader: repository });
}

describeImportRunWriterContract('InMemoryImportRunRepository', fixture);
describeImportRunReaderContract('InMemoryImportRunRepository', fixture);
