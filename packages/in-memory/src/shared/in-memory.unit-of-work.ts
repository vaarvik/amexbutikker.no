import type { TransactionalPorts, UnitOfWork } from '@amexbutikker/contracts';
import type { InMemoryPortsFactory, InMemoryTables } from './shared.ports.js';

/**
 * Runs work against a copy of the tables and swaps the copy in on success. Runs are queued one
 * after another, which satisfies the serialisation invariant trivially.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  private queue: Promise<unknown> = Promise.resolve();

  public constructor(
    private readonly tables: InMemoryTables,
    private readonly portsFor: InMemoryPortsFactory,
  ) {}

  public run<T>(work: (ports: TransactionalPorts) => Promise<T>): Promise<T> {
    const result = this.queue.then(() => this.execute(work));
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async execute<T>(work: (ports: TransactionalPorts) => Promise<T>): Promise<T> {
    const draft = this.copy(this.tables);
    const value = await work(this.portsFor(draft));
    this.commit(draft);
    return value;
  }

  private copy(tables: InMemoryTables): InMemoryTables {
    return {
      places: new Map(tables.places),
      chains: new Map(tables.chains),
      chainHints: new Map(tables.chainHints),
      evidence: new Map(tables.evidence),
      statuses: new Map(tables.statuses),
      importRuns: new Map(tables.importRuns),
      devices: new Map(tables.devices),
      deviceAttestations: new Map(tables.deviceAttestations),
      unmatchedDescriptors: new Map(tables.unmatchedDescriptors),
    };
  }

  private commit(draft: InMemoryTables): void {
    this.replace(this.tables.places, draft.places);
    this.replace(this.tables.chains, draft.chains);
    this.replace(this.tables.chainHints, draft.chainHints);
    this.replace(this.tables.evidence, draft.evidence);
    this.replace(this.tables.statuses, draft.statuses);
    this.replace(this.tables.importRuns, draft.importRuns);
    this.replace(this.tables.devices, draft.devices);
    this.replace(this.tables.deviceAttestations, draft.deviceAttestations);
    this.replace(this.tables.unmatchedDescriptors, draft.unmatchedDescriptors);
  }

  private replace<K, V>(target: Map<K, V>, source: ReadonlyMap<K, V>): void {
    target.clear();
    for (const [key, value] of source) {
      target.set(key, value);
    }
  }
}
