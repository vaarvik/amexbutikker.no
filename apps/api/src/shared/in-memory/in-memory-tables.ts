import type {
  Chain,
  ChainHint,
  ChainId,
  Evidence,
  EvidenceId,
  ImportRunId,
  ImportRunReport,
  ImportSource,
  Place,
  PlaceId,
  PlaceStatusSnapshot,
  TransactionalPorts,
} from '@amexbutikker/contracts';

export interface InMemoryImportRun {
  readonly runId: ImportRunId;
  readonly source: ImportSource;
  readonly startedAt: Date;
  readonly dryRun: boolean;
  readonly report: ImportRunReport | null;
}

/**
 * The state behind every in-memory adapter: one map per table, in insertion order.
 * Values are immutable; adapters replace entries instead of mutating them.
 */
export interface InMemoryTables {
  readonly places: Map<PlaceId, Place>;
  readonly chains: Map<ChainId, Chain>;
  readonly chainHints: Map<ChainId, ChainHint>;
  readonly evidence: Map<EvidenceId, Evidence>;
  readonly statuses: Map<PlaceId, PlaceStatusSnapshot>;
  readonly importRuns: Map<ImportRunId, InMemoryImportRun>;
}

/** Creates empty tables. */
export interface InMemoryTablesFactory {
  create(): InMemoryTables;
}

export class EmptyInMemoryTablesFactory implements InMemoryTablesFactory {
  public create(): InMemoryTables {
    return {
      places: new Map(),
      chains: new Map(),
      chainHints: new Map(),
      evidence: new Map(),
      statuses: new Map(),
      importRuns: new Map(),
    };
  }
}

/** Builds the transactional ports over a set of tables. Supplied by the composition root. */
export type InMemoryPortsFactory = (tables: InMemoryTables) => TransactionalPorts;
