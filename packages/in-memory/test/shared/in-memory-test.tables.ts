import type { Clock, TransactionalPorts } from '@amexbutikker/contracts';
import { TrigramNameSimilarity } from '@amexbutikker/domain';
import { InMemoryChainRepository } from '../../src/chains/in-memory-chain.repository.js';
import { InMemoryEvidenceRepository } from '../../src/evidence/in-memory-evidence.repository.js';
import { InMemoryPlaceRepository } from '../../src/places/in-memory-place.repository.js';
import { EmptyInMemoryTablesFactory } from '../../src/shared/empty-in-memory-tables.factory.js';
import type { InMemoryTables } from '../../src/shared/shared.ports.js';
import { InMemoryPlaceStatusRepository } from '../../src/status/in-memory-place-status.repository.js';

const clock: Clock = { now: () => new Date('2026-11-03T12:00:00.000Z') };
const names = new TrigramNameSimilarity();

/** The transactional ports over the given tables, wired the way the composition root does it. */
export function portsFor(tables: InMemoryTables): TransactionalPorts {
  return {
    places: new InMemoryPlaceRepository(tables, names, clock),
    chains: new InMemoryChainRepository(tables, names, clock),
    evidence: new InMemoryEvidenceRepository(tables),
    statuses: new InMemoryPlaceStatusRepository(tables),
  };
}

/** Empty tables plus the ports over them. */
export function freshTables(): { readonly tables: InMemoryTables } & TransactionalPorts {
  const tables = new EmptyInMemoryTablesFactory().create();
  return { tables, ...portsFor(tables) };
}
