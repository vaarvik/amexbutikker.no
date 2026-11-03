import { ValidationError } from '@amexbutikker/contracts';
import type {
  MatchDecider,
  MatchDecision,
  PlaceCandidate,
  ValidationIssue,
} from '@amexbutikker/contracts';

export interface MatchDeciderOptions {
  /** Score the top candidate needs to be opened directly. In (0, 1]. Default 0.6. */
  readonly openThreshold?: number;
  /** How far the top candidate must be ahead of the second. In [0, 1]. Default 0.15. */
  readonly minimumLead?: number;
}

export class ThresholdMatchDecider implements MatchDecider {
  private readonly openThreshold: number;
  private readonly minimumLead: number;

  /** @throws ValidationError when an option is out of range. */
  public constructor(options: MatchDeciderOptions = {}) {
    this.openThreshold = options.openThreshold ?? 0.6;
    this.minimumLead = options.minimumLead ?? 0.15;
    const issues: ValidationIssue[] = [];
    if (!(this.openThreshold > 0 && this.openThreshold <= 1)) {
      issues.push({ path: ['openThreshold'], message: 'must be in (0, 1]' });
    }
    if (!(this.minimumLead >= 0 && this.minimumLead <= 1)) {
      issues.push({ path: ['minimumLead'], message: 'must be in [0, 1]' });
    }
    if (issues.length > 0) {
      throw new ValidationError('Invalid match decider options.', issues);
    }
  }

  public decide(candidates: readonly PlaceCandidate[]): MatchDecision {
    const [top, second] = candidates;
    if (top === undefined) {
      return { type: 'none' };
    }
    const clearlyAhead =
      second === undefined || top.score - second.score >= this.minimumLead - 1e-9;
    return top.score >= this.openThreshold && clearlyAhead
      ? { type: 'open', placeId: top.place.id }
      : { type: 'choose' };
  }
}
