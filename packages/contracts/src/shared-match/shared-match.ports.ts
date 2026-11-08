import type { MatchDecision } from './shared-match.use-cases.js';
import type {
  ParsedSharedPlace,
  PlaceCandidate,
  ResolvedSharedLink,
} from './shared-match.model.js';

/** Reads place details out of text shared from Google Maps or Apple Maps. Pure, no network. */
export interface SharedTextParser {
  /**
   * @param text raw shared text, Norwegian or English.
   * @returns what could be parsed; fields that could not be read are null.
   * @throws ValidationError when the text is empty or longer than SHARED_TEXT_MAX_LENGTH.
   */
  parse(text: string): ParsedSharedPlace;
}

/** Follows a maps link to learn more about the place. */
export interface SharedLinkResolver {
  /**
   * @returns extra details, or null when the link is not supported or could not be resolved.
   *   Never throws for an unresolvable link.
   */
  resolve(url: string): Promise<ResolvedSharedLink | null>;
}

/** Finds known places that a shared place may refer to. */
export interface PlaceMatcher {
  /**
   * @returns at most 3 candidates, best first. Empty when nothing is plausible.
   */
  match(parsed: ParsedSharedPlace): Promise<PlaceCandidate[]>;
}

/** Decides what the app does with match candidates. Pure. */
export interface MatchDecider {
  /**
   * @param candidates best first, as PlaceMatcher returns them.
   * @returns `open` when the top candidate clears the threshold and is clearly ahead of the
   *   second, `choose` when there are candidates otherwise, `none` when there are none.
   */
  decide(candidates: readonly PlaceCandidate[]): MatchDecision;
}

/**
 * Turns the merchant name of a card payment ("SQ *KAFFEBRENNERIET AS", "REMA 1000 MAJORSTUEN")
 * into a name to match places on. Pure, no network.
 */
export interface MerchantNameParser {
  /**
   * Drops payment-processor prefixes ("SQ *", "SumUp *", "Zettle_*"), company suffixes ("AS",
   * "ASA") and reference numbers, and collapses whitespace. Keeps branch and city words; the
   * matcher's scoring handles them.
   *
   * @returns the cleaned name, or null when nothing is left.
   */
  parse(merchant: string): string | null;
}
