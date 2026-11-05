import type { NameSimilarity, PhysicalPlace } from '@amexbutikker/contracts';
import type { BrregUnderenhet } from './brreg.model.js';
import type { BrregPlaceMatch, BrregPlaceMatcher } from './brreg.ports.js';

export interface AddressBrregPlaceMatcherConfig {
  /** Lowest name similarity that counts as the same business. */
  readonly minimumScore: number;
  /** How far the best name must lead the runner-up at the same address. */
  readonly minimumLead: number;
}

/** Legal-form words that registry names carry and place names do not. */
const LEGAL_WORDS = new Set(['as', 'asa', 'ans', 'da', 'nuf', 'sa', 'ba', 'avd', 'avdeling']);

/** Trigram similarity at which two single words count as the same word. */
const SAME_WORD_SCORE = 0.5;

/** Shortest word that counts when found inside another ("vero" in "veromodaoslo"). */
const MIN_CONTAINED_LENGTH = 3;

/**
 * Matches a unit to a place with the same street address (the candidates already share its
 * postcode) and a similar name. Conservative: an unclear case stays unmatched.
 * The first word of the place name must also appear in the registry name. Shops in a shopping
 * centre share one address, and names like "Anton Sport CC Vest" and "McDonald's CC Vest" are
 * similar only through the centre's name.
 */
export class AddressBrregPlaceMatcher implements BrregPlaceMatcher {
  public constructor(
    private readonly names: NameSimilarity,
    private readonly config: AddressBrregPlaceMatcherConfig,
  ) {}

  public match(unit: BrregUnderenhet, candidates: readonly PhysicalPlace[]): BrregPlaceMatch {
    if (unit.street === null) {
      return { kind: 'unmatched', reason: 'has no street address' };
    }
    const street = this.street(unit.street);
    const where = `${unit.street}, ${unit.postcode ?? '????'}`;
    const atAddress = candidates.filter(
      (place) => place.address.street !== null && this.street(place.address.street) === street,
    );
    if (atAddress.length === 0) {
      return { kind: 'unmatched', reason: `no place at ${where}` };
    }

    const name = this.businessName(unit.name);
    const unitWords = this.words(name);
    const [best, runnerUp] = atAddress
      .filter((place) => this.sharesLeadingWord(place.name, unitWords))
      .map((place) => ({
        place,
        score: this.names.similarity(name, this.names.normalize(place.name)),
      }))
      .sort((a, b) => b.score - a.score);
    if (best === undefined || best.score < this.config.minimumScore) {
      return { kind: 'unmatched', reason: `no place at ${where} is named like "${unit.name}"` };
    }
    if (runnerUp !== undefined && best.score - runnerUp.score < this.config.minimumLead) {
      const tied = atAddress.filter(
        (place) =>
          this.sharesLeadingWord(place.name, unitWords) &&
          best.score - this.names.similarity(name, this.names.normalize(place.name)) <
            this.config.minimumLead,
      ).length;
      return {
        kind: 'unmatched',
        reason: `${String(tied)} places at ${where} are named like "${unit.name}"`,
      };
    }
    return { kind: 'matched', place: best.place, score: best.score };
  }

  /** Normalised, with `9 B` written as `9b`. */
  private street(street: string): string {
    return this.names.normalize(street).replace(/(\d)\s+([a-z])\b/g, '$1$2');
  }

  private businessName(name: string): string {
    return this.words(this.names.normalize(name))
      .filter((word) => !LEGAL_WORDS.has(word))
      .join(' ');
  }

  /**
   * Whether the first word of the place name is, or is part of, a word of the unit name.
   * Not the other way round: "butikk" inside "Telenorbutikken" says nothing.
   */
  private sharesLeadingWord(placeName: string, unitWords: readonly string[]): boolean {
    const [leading] = this.words(this.names.normalize(placeName));
    return (
      leading !== undefined &&
      unitWords.some(
        (word) =>
          (leading.length >= MIN_CONTAINED_LENGTH && word.includes(leading)) ||
          this.names.similarity(word, leading) >= SAME_WORD_SCORE,
      )
    );
  }

  private words(normalized: string): string[] {
    return normalized.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== '');
  }
}
