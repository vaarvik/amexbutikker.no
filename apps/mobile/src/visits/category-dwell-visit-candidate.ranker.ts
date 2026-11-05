import type { PlaceCategory } from '@amexbutikker/contracts';
import type { DwellRange, RankedVisitCandidate, VisitRegion } from './visits.model';
import type { VisitCandidateRanker } from './visits.ports';

export interface CategoryDwellVisitCandidateRankerConfig {
  /** Typical visit length per category. */
  readonly dwellRanges: Readonly<Record<PlaceCategory, DwellRange>>;
  /** Weight of the time inside, relative to the longest stay of the visit. */
  readonly timeWeight: number;
  /** Weight of how well the visit length fits the category. */
  readonly categoryWeight: number;
}

/**
 * Scores each place of a visit by time inside its fence (the fence the phone stayed in longest
 * is most likely the place) and by how well the visit length fits the category: two minutes
 * fits a kiosk, not a restaurant. Ties keep the input order, which is nearest first.
 */
export class CategoryDwellVisitCandidateRanker implements VisitCandidateRanker {
  public constructor(private readonly config: CategoryDwellVisitCandidateRankerConfig) {}

  public rank(
    stays: readonly { readonly region: VisitRegion; readonly insideMs: number }[],
  ): readonly RankedVisitCandidate[] {
    const longest = Math.max(0, ...stays.map((stay) => stay.insideMs));
    if (longest === 0) {
      return [];
    }
    const total = this.config.timeWeight + this.config.categoryWeight;
    return stays
      .map(({ region, insideMs }, order) => ({
        order,
        ranked: {
          candidate: { placeId: region.placeId, name: region.name, category: region.category },
          insideMs,
          score:
            (this.config.timeWeight * (insideMs / longest) +
              this.config.categoryWeight * this.fit(region.category, insideMs)) /
            total,
        },
      }))
      .sort((a, b) => b.ranked.score - a.ranked.score || a.order - b.order)
      .map(({ ranked }) => ranked);
  }

  /** 1 inside the category's range, falling off proportionally outside it. */
  private fit(category: PlaceCategory, insideMs: number): number {
    const { minMs, maxMs } = this.config.dwellRanges[category];
    if (insideMs < minMs) {
      return insideMs / minMs;
    }
    return insideMs > maxMs ? maxMs / insideMs : 1;
  }
}
