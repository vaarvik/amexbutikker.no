import type {
  AppendHouseholdRecordsResponseDto,
  HouseholdId,
  HouseholdRecordListResponseDto,
  HouseholdResponseDto,
} from '@amexbutikker/contracts';
import type {
  HouseholdInvite,
  HouseholdStatus,
  HouseholdSyncResult,
  StoredHousehold,
} from './households.model';

/** The household endpoints. Throws ApiError like the other clients. */
export interface HouseholdsApiClient {
  create(joinToken: string): Promise<HouseholdResponseDto>;
  join(householdId: HouseholdId, joinToken: string): Promise<HouseholdResponseDto>;
  /** null when this phone is in no household (404). */
  find(): Promise<HouseholdResponseDto | null>;
  leave(): Promise<void>;
  append(sealed: readonly string[]): Promise<AppendHouseholdRecordsResponseDto>;
  list(afterSeq: number): Promise<HouseholdRecordListResponseDto>;
}

/**
 * Seals and opens records with the household key (XChaCha20-Poly1305, a fresh random nonce per
 * record), and derives the join token from the key (HKDF-SHA256). Pure apart from the nonce.
 */
export interface HouseholdCipher {
  /** A new random key, base64url. */
  newKey(): string;
  seal(key: string, plaintext: string): string;
  /** @throws when the record was not sealed with this key or was changed. */
  open(key: string, sealed: string): string;
  /** One way: the server can check it but not get the key back. */
  joinToken(key: string): string;
}

/** Turns an invite into the link in the QR code and back. Pure. */
export interface HouseholdInviteTranslator {
  toLink(invite: HouseholdInvite): string;
  /** null when the text is not an invite link. */
  fromLink(text: string): HouseholdInvite | null;
}

/** The household this phone is in, kept in secure storage (it holds the key). */
export interface HouseholdStorage {
  /** null when in none, or the stored value is unreadable. */
  find(): Promise<StoredHousehold | null>;
  /** null forgets the household. */
  save(household: StoredHousehold | null): Promise<void>;
}

/**
 * Shares Bonus spending between the phones in a household. Every change to spending on this
 * phone is queued and sent sealed; changes from the others are opened and merged in. The server
 * sees only sealed records.
 */
export interface HouseholdService {
  status(): Promise<HouseholdStatus>;
  /** Starts a household and shares everything already in Bonus on this phone. */
  create(): Promise<HouseholdStatus>;
  /**
   * Joins from an invite link and merges both sides: this phone's spending is shared, and the
   * household's card and goals replace this phone's.
   *
   * @throws ValidationError when the link is not an invite.
   */
  join(link: string): Promise<HouseholdStatus>;
  /** Leaves; this phone keeps a copy of everything as it is now. */
  leave(): Promise<HouseholdStatus>;
  /** Sends pending changes, then reads new ones. Never throws: offline gives `offline`. */
  sync(): Promise<HouseholdSyncResult>;
}
