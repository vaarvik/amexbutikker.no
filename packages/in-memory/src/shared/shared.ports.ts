import type {
  Chain,
  Device,
  DeviceAttestation,
  ChainHint,
  ChainId,
  Evidence,
  EvidenceId,
  Household,
  HouseholdId,
  HouseholdMembership,
  HouseholdRecord,
  ImportRunId,
  ImportRunReport,
  ImportSource,
  Place,
  PlaceId,
  PlaceStatusSnapshot,
  TransactionalPorts,
  UnmatchedDescriptor,
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
  readonly deviceAttestations: Map<UserId, DeviceAttestation>;
  readonly households: Map<HouseholdId, Household>;
  /** One membership per user: the current one, or the last one it left. */
  readonly householdMembers: Map<UserId, HouseholdMembership>;
  /** Append-only; `seq` is the position plus one. */
  readonly householdRecords: HouseholdRecord[];
  /** Keyed by the normalised descriptor. */
  readonly unmatchedDescriptors: Map<string, UnmatchedDescriptor>;
}

/** Creates empty tables. */
export interface InMemoryTablesFactory {
  create(): InMemoryTables;
}

/** Builds the transactional ports over a set of tables. Supplied by the composition root. */
export type InMemoryPortsFactory = (tables: InMemoryTables) => TransactionalPorts;
