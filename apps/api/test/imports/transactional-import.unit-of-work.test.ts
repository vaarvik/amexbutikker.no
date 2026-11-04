import type { TransactionalPorts } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import { TrigramNameSimilarity } from '@amexbutikker/domain';
import {
  EmptyInMemoryTablesFactory,
  InMemoryChainRepository,
  InMemoryEvidenceRepository,
  InMemoryPlaceRepository,
  InMemoryPlaceStatusRepository,
  InMemoryUnitOfWork,
} from '@amexbutikker/in-memory';
import type { InMemoryTables } from '@amexbutikker/in-memory';
import { beforeEach, describe, expect, it } from 'vitest';
import { TransactionalImportUnitOfWork } from '../../src/imports/transactional-import.unit-of-work.js';

const clock = { now: () => new Date('2026-11-04T08:00:00Z') };
const names = new TrigramNameSimilarity();

function portsFor(tables: InMemoryTables): TransactionalPorts {
  return {
    places: new InMemoryPlaceRepository(tables, names, clock),
    chains: new InMemoryChainRepository(tables, names, clock),
    evidence: new InMemoryEvidenceRepository(tables),
    statuses: new InMemoryPlaceStatusRepository(tables),
  };
}

describe('TransactionalImportUnitOfWork', () => {
  let tables: InMemoryTables;
  let unitOfWork: TransactionalImportUnitOfWork;

  beforeEach(() => {
    tables = new EmptyInMemoryTablesFactory().create();
    unitOfWork = new TransactionalImportUnitOfWork(new InMemoryUnitOfWork(tables, portsFor));
  });

  it('commits a real run and returns its value', async () => {
    const result = await unitOfWork.run(false, async (ports) => {
      await ports.places.create(new TestData().physicalPlace());
      return 'done';
    });

    expect(result).toBe('done');
    expect(tables.places.size).toBe(1);
  });

  it('rolls a dry run back but still returns its value', async () => {
    const result = await unitOfWork.run(true, async (ports) => {
      await ports.places.create(new TestData().physicalPlace());
      return (await ports.places.listByChain(new TestData().chainId())).length + 1;
    });

    expect(result).toBe(1);
    expect(tables.places.size).toBe(0);
  });

  it('rethrows what the work threw, after rolling back', async () => {
    const failure = new Error('boom');

    await expect(
      unitOfWork.run(false, async (ports) => {
        await ports.places.create(new TestData().physicalPlace());
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(tables.places.size).toBe(0);
  });
});
