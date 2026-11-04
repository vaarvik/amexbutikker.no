import type { ColumnType, Generated } from 'kysely';

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
  unmatched_descriptors: UnmatchedDescriptorsTable;
}
