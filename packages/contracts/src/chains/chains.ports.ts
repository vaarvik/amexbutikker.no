import type { Chain } from './chains.model.js';
import type { UpsertOutcome } from '../places/places.ports.js';
import type { ChainId } from '../shared/shared.model.js';
import type { ChainHint } from '../status/status.model.js';

/** Read access to chains and their hints. */
export interface ChainReader {
  /**
   * @throws NotFoundError when no chain has this id.
   */
  getById(id: ChainId): Promise<Chain>;

  /**
   * Finds a chain by exact name, compared accent- and case-insensitively after trimming.
   *
   * @returns null when none matches. If several match, the oldest.
   */
  findByName(name: string): Promise<Chain | null>;

  /**
   * @returns the stored hint, or null when none has been calculated yet. Does not throw for an unknown chain.
   */
  getHint(chainId: ChainId): Promise<ChainHint | null>;
}

/** A chain as an importer sees it, before it has an id. */
export interface ChainSourceRecord {
  readonly name: string;
  /** Preferred identity. When null the upsert is keyed by name. */
  readonly brandWikidata: string | null;
}

export interface ChainUpsertResult {
  readonly chainId: ChainId;
  readonly outcome: UpsertOutcome;
}

/** Write access to chains and their hints. */
export interface ChainWriter {
  /**
   * @throws ConflictError when `chain.id` exists, or `chain.brandWikidata` is already taken.
   */
  create(chain: Chain): Promise<void>;

  /**
   * Inserts or updates a chain keyed by `brandWikidata`, or by name when that is null.
   *
   * @param newId used only when the chain does not exist yet.
   */
  upsertFromSource(record: ChainSourceRecord, newId: ChainId): Promise<ChainUpsertResult>;

  /**
   * Stores the hint for its chain, replacing any earlier one.
   *
   * @throws NotFoundError when the chain does not exist.
   */
  saveHint(hint: ChainHint): Promise<void>;
}
