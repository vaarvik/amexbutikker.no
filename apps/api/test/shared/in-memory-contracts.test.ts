import type { Clock, TransactionalPorts } from '@amexbutikker/contracts';
import {
  describeChainReaderContract,
  describeChainWriterContract,
  describeEvidenceContract,
  describeImportRunWriterContract,
  describePlaceReaderContract,
  describePlaceStatusContract,
  describePlaceWriterContract,
  describeUnitOfWorkContract,
} from '@amexbutikker/contracts/test-kit';
import { TrigramNameSimilarity } from '@amexbutikker/domain';
import { InMemoryChainRepository } from '../../src/chains/in-memory/in-memory-chain-repository.js';
import { InMemoryEvidenceRepository } from '../../src/evidence/in-memory/in-memory-evidence-repository.js';
import { InMemoryImportRunRepository } from '../../src/imports/in-memory/in-memory-import-run-repository.js';
import { InMemoryPlaceRepository } from '../../src/places/in-memory/in-memory-place-repository.js';
import { EmptyInMemoryTablesFactory } from '../../src/shared/in-memory/in-memory-tables.js';
import type { InMemoryTables } from '../../src/shared/in-memory/in-memory-tables.js';
import { InMemoryUnitOfWork } from '../../src/shared/in-memory/in-memory-unit-of-work.js';
import { InMemoryPlaceStatusRepository } from '../../src/status/in-memory/in-memory-place-status-repository.js';

const clock: Clock = { now: () => new Date('2026-11-03T12:00:00.000Z') };
const names = new TrigramNameSimilarity();

function portsFor(tables: InMemoryTables): TransactionalPorts {
  return {
    places: new InMemoryPlaceRepository(tables, names, clock),
    chains: new InMemoryChainRepository(tables, names, clock),
    evidence: new InMemoryEvidenceRepository(tables),
    statuses: new InMemoryPlaceStatusRepository(tables),
  };
}

function fresh() {
  const tables = new EmptyInMemoryTablesFactory().create();
  return { tables, ...portsFor(tables) };
}

describePlaceReaderContract('InMemoryPlaceRepository', () => {
  const { places, chains } = fresh();
  return Promise.resolve({ reader: places, writer: places, chains });
});

describePlaceWriterContract('InMemoryPlaceRepository', () => {
  const { places } = fresh();
  return Promise.resolve({ writer: places, reader: places });
});

describeChainReaderContract('InMemoryChainRepository', () => {
  const { chains } = fresh();
  return Promise.resolve({ reader: chains, writer: chains });
});

describeChainWriterContract('InMemoryChainRepository', () => {
  const { chains } = fresh();
  return Promise.resolve({ writer: chains, reader: chains });
});

describeEvidenceContract('InMemoryEvidenceRepository', () => {
  const { evidence, places, chains } = fresh();
  return Promise.resolve({ reader: evidence, writer: evidence, places, chains });
});

describePlaceStatusContract('InMemoryPlaceStatusRepository', () => {
  const { statuses, places, chains } = fresh();
  return Promise.resolve({ reader: statuses, writer: statuses, places, chains });
});

describeImportRunWriterContract('InMemoryImportRunRepository', () => {
  const { tables } = fresh();
  return Promise.resolve({ writer: new InMemoryImportRunRepository(tables) });
});

describeUnitOfWorkContract('InMemoryUnitOfWork', () => {
  const { tables, places } = fresh();
  return Promise.resolve({ unitOfWork: new InMemoryUnitOfWork(tables, portsFor), places });
});
