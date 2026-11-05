import type { InMemoryTables, InMemoryTablesFactory } from './shared.ports.js';

export class EmptyInMemoryTablesFactory implements InMemoryTablesFactory {
  public create(): InMemoryTables {
    return {
      places: new Map(),
      chains: new Map(),
      chainHints: new Map(),
      evidence: new Map(),
      statuses: new Map(),
      importRuns: new Map(),
      devices: new Map(),
      unmatchedDescriptors: new Map(),
    };
  }
}
