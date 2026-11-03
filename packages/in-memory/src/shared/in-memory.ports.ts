import type {
  Chain,
  Device,
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
  UserId,
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
  readonly devices: Map<UserId, Device>;
}

/** Creates empty tables. */
export interface InMemoryTablesFactory {
  create(): InMemoryTables;
}

/** Builds the transactional ports over a set of tables. Supplied by the composition root. */
export type InMemoryPortsFactory = (tables: InMemoryTables) => TransactionalPorts;
