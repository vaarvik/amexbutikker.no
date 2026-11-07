import { ValidationError } from '@amexbutikker/contracts';
import type {
  ExistingPlace,
  NameSimilarity,
  Place,
  PlaceDuplicateMatcher,
  ValidationIssue,
} from '@amexbutikker/contracts';

export interface NameDistancePlaceDuplicateMatcherConfig {
  /** A physical place this close (metres) with a similar name is the same place. Default 75. */
  readonly maxDistanceM?: number;
  /** Name similarity two physical places need, in (0, 1]. Default 0.6. */
  readonly minNameSimilarity?: number;
  /** Name similarity two online shops on different websites need, in (0, 1]. Default 0.9. */
  readonly minOnlineNameSimilarity?: number;
}

/**
 * Physical: a stored physical place within `maxDistanceM` whose name is similar enough; the most
 * similar wins, then the nearest. Online: a stored shop on the same website host (`www.` and
 * case ignored), or one with an almost identical name.
 */
export class NameDistancePlaceDuplicateMatcher implements PlaceDuplicateMatcher {
  private readonly maxDistanceM: number;
  private readonly minNameSimilarity: number;
  private readonly minOnlineNameSimilarity: number;

  /** @throws ValidationError when an option is out of range. */
  public constructor(
    private readonly names: NameSimilarity,
    options: NameDistancePlaceDuplicateMatcherConfig = {},
  ) {
    this.maxDistanceM = options.maxDistanceM ?? 75;
    this.minNameSimilarity = options.minNameSimilarity ?? 0.6;
    this.minOnlineNameSimilarity = options.minOnlineNameSimilarity ?? 0.9;
    const issues: ValidationIssue[] = [];
    if (!(this.maxDistanceM > 0)) {
      issues.push({ path: ['maxDistanceM'], message: 'must be positive' });
    }
    for (const [key, value] of [
      ['minNameSimilarity', this.minNameSimilarity],
      ['minOnlineNameSimilarity', this.minOnlineNameSimilarity],
    ] as const) {
      if (!(value > 0 && value <= 1)) {
        issues.push({ path: [key], message: 'must be in (0, 1]' });
      }
    }
    if (issues.length > 0) {
      throw new ValidationError('Invalid duplicate matcher options.', issues);
    }
  }

  public findDuplicate(place: Place, existing: readonly ExistingPlace[]): Place | null {
    let best: { place: Place; score: number; distanceM: number } | null = null;
    for (const candidate of existing) {
      const score = this.score(place, candidate);
      if (score === null) continue;
      const distanceM = candidate.distanceM ?? 0;
      if (
        best === null ||
        score > best.score ||
        (score === best.score && distanceM < best.distanceM)
      ) {
        best = { place: candidate.place, score, distanceM };
      }
    }
    return best?.place ?? null;
  }

  /** How alike the two are, or null when they are not the same place. Same website scores 1. */
  private score(place: Place, candidate: ExistingPlace): number | null {
    const other = candidate.place;
    if (place.kind === 'physical') {
      return other.kind === 'physical' &&
        candidate.distanceM !== null &&
        candidate.distanceM <= this.maxDistanceM
        ? this.atLeast(this.names.similarity(place.name, other.name), this.minNameSimilarity)
        : null;
    }
    if (other.kind !== 'online') {
      return null;
    }
    const host = this.host(place.website);
    if (host !== null && host === this.host(other.website)) {
      return 1;
    }
    return this.atLeast(
      this.names.similarity(place.name, other.name),
      this.minOnlineNameSimilarity,
    );
  }

  private atLeast(score: number, minimum: number): number | null {
    return score >= minimum ? score : null;
  }

  private host(website: string): string | null {
    try {
      return new URL(website).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return null;
    }
  }
}
