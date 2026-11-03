import {
  describeChainReaderContract,
  describeChainWriterContract,
} from '@amexbutikker/contracts/test-kit';
import { freshTables } from '../shared/in-memory-test.tables.js';

describeChainReaderContract('InMemoryChainRepository', () => {
  const { chains } = freshTables();
  return Promise.resolve({ reader: chains, writer: chains });
});

describeChainWriterContract('InMemoryChainRepository', () => {
  const { chains } = freshTables();
  return Promise.resolve({ writer: chains, reader: chains });
});
