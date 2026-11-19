import {
  describePasskeyReaderContract,
  describePasskeyWriterContract,
} from '@amexbutikker/contracts/test-kit';
import { InMemoryPasskeyRepository } from '../../src/access/in-memory-passkey.repository.js';

function fixture() {
  const repository = new InMemoryPasskeyRepository();
  return Promise.resolve({ writer: repository, reader: repository });
}

describePasskeyWriterContract('InMemoryPasskeyRepository', fixture);
describePasskeyReaderContract('InMemoryPasskeyRepository', fixture);
