import {
  describePlaceReaderContract,
  describePlaceWriterContract,
} from '@amexbutikker/contracts/test-kit';
import { freshTables } from '../shared/in-memory-test.tables.js';

describePlaceReaderContract('InMemoryPlaceRepository', () => {
  const { places, chains, statuses } = freshTables();
  return Promise.resolve({ reader: places, writer: places, chains, statuses });
});

describePlaceWriterContract('InMemoryPlaceRepository', () => {
  const { places } = freshTables();
  return Promise.resolve({ writer: places, reader: places });
});
