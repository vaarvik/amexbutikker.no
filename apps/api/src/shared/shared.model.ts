import type { ColumnType, Generated } from 'kysely';
import type { DomainError, ErrorResponseDto } from '@amexbutikker/contracts';

// Table shapes as Postgres returns them. Queries are written in SQL; every row is validated with
// zod before it becomes a domain object, so these types only document the schema for Kysely.

type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface ChainsTable {
  id: string;
  name: string;
  brand_wikidata: string | null;
  created_at: Timestamp;
}

export interface PlacesTable {
  id: string;
  kind: 'physical' | 'online';
  chain_id: string | null;
  name: string;
  category: string;
  street: string | null;
  postcode: string | null;
  city: string | null;
  /** geography(Point, 4326); read with ST_Y / ST_X. */
  geom: unknown;
  website: string | null;
  osm_ref: string | null;
  brreg_orgnr: string | null;
  /** Generated: f_normalize_name(name). Never written. */
  normalized_name: Generated<string>;
  created_at: Timestamp;
}

export interface EvidenceTable {
  id: string;
  place_id: string | null;
  chain_id: string | null;
  kind: string;
  result: string;
  source: string;
  source_ref: string;
  observed_at: Timestamp;
  imported_at: Timestamp;
  user_id: string | null;
  note: string | null;
}

export interface PlaceStatusTable {
  place_id: string;
  status: string;
  confidence: number;
  basis: string | null;
  verified: boolean;
  last_evidence_at: Timestamp | null;
  calculated_at: Timestamp;
}

export interface ChainHintsTable {
  chain_id: string;
  accepted_count: number;
  total_with_evidence: number;
  calculated_at: Timestamp;
}

export interface ImportRunsTable {
  id: string;
  source: string;
  dry_run: boolean;
  started_at: Timestamp;
  finished_at: Timestamp | null;
  status: string | null;
  fetched_at: Timestamp | null;
  counts: unknown;
  metrics: unknown;
  messages: unknown;
}

export interface DevicesTable {
  user_id: string;
  platform: string;
  created_at: Timestamp;
  attestation_kind: string | null;
  attested_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
  app_attest_key_id: string | null;
}

export interface HouseholdsTable {
  id: string;
  join_token_hash: string;
  created_at: Timestamp;
}

export interface HouseholdMembersTable {
  user_id: string;
  household_id: string;
  joined_at: Timestamp;
  left_at: ColumnType<Date | null, Date | string | null, Date | string | null>;
}

export interface HouseholdRecordsTable {
  seq: ColumnType<string, never, never>;
  household_id: string;
  author_id: string;
  sealed: string;
  created_at: Timestamp;
}

export interface UnmatchedDescriptorsTable {
  descriptor: string;
  first_seen_on: string;
  last_seen_on: string;
}

export interface Database {
  chains: ChainsTable;
  places: PlacesTable;
  evidence: EvidenceTable;
  place_status: PlaceStatusTable;
  chain_hints: ChainHintsTable;
  import_runs: ImportRunsTable;
  devices: DevicesTable;
  households: HouseholdsTable;
  household_members: HouseholdMembersTable;
  household_records: HouseholdRecordsTable;
  unmatched_descriptors: UnmatchedDescriptorsTable;
}

export interface HttpErrorResponse {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: ErrorResponseDto;
  /** True when the error is a bug or outage rather than a client mistake; it should be logged. */
  readonly unexpected: boolean;
}

/** Maps a constraint name to the typed error it means for the caller. */
export type ConstraintErrors = Readonly<Record<string, () => DomainError>>;
