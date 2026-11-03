import { describePlaceStatusContract } from '@amexbutikker/contracts/test-kit';
import { freshTables } from '../shared/in-memory-test.tables.js';

describePlaceStatusContract('InMemoryPlaceStatusRepository', () => {
  const { statuses, places, chains } = freshTables();
  return Promise.resolve({ reader: statuses, writer: statuses, places, chains });
});
