import type { ChainReader, ChainWriter } from './chain-ports.js';
import type { EvidenceReader, EvidenceWriter } from './evidence-ports.js';
import type { PlaceReader, PlaceWriter } from './place-ports.js';
import type { PlaceStatusReader, PlaceStatusWriter } from './place-status-ports.js';

/**
 * Ports bound to one transaction. Readers are included so work can read what it just wrote
 * (append evidence, then recalculate from it).
 */
export interface TransactionalPorts {
  readonly places: PlaceReader & PlaceWriter;
  readonly chains: ChainReader & ChainWriter;
  readonly evidence: EvidenceReader & EvidenceWriter;
  readonly statuses: PlaceStatusReader & PlaceStatusWriter;
}

/** Runs work atomically. */
export interface UnitOfWork {
  /**
   * Runs `work` in one transaction. Commits when it resolves, rolls back when it rejects.
   * The ports must not be used after `work` settles.
   *
   * Invariant: concurrent runs that touch the same place behave as if run one after another,
   * so a status recalculation always sees all evidence committed before it. Implementations may
   * achieve this by retrying `work` (e.g. on a serialisation failure), so `work` must have no
   * side effects outside the given ports.
   *
   * @returns what `work` resolved with.
   * @throws whatever `work` threw, after rolling back.
   */
  run<T>(work: (ports: TransactionalPorts) => Promise<T>): Promise<T>;
}
