import { describeEvidenceContract } from '@amexbutikker/contracts/test-kit';
import { freshTables } from '../shared/in-memory-test.tables.js';

describeEvidenceContract('InMemoryEvidenceRepository', () => {
  const { evidence, places, chains } = freshTables();
  return Promise.resolve({ reader: evidence, writer: evidence, places, chains });
});
