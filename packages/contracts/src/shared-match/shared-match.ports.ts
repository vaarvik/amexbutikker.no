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
