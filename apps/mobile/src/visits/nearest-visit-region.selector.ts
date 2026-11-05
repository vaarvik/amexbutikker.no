import type { AcceptanceStatus, PlaceSummaryDto } from '@amexbutikker/contracts';
import type { VisitPromptKind, VisitRegion } from './visits.model';
import type { VisitRegionSelector } from './visits.ports';

export interface NearestVisitRegionSelectorConfig {
  /** iOS monitors at most 20 regions per app; keep a little headroom. */
  readonly maxRegions: number;
  readonly radiusM: number;
}

/**
 * Ask where the answer is missing, disputed or not yet confirmed by users; announce where Amex
 * is confirmed to work; skip a confirmed "Nei".
 */
const PROMPTS: Readonly<Record<AcceptanceStatus, VisitPromptKind | null>> = {
  unknown: 'ask',
  mixed: 'ask',
  likely_accepted: 'ask',
  likely_rejected: 'ask',
  accepted: 'announce',
  rejected: null,
};

/** The nearest physical places that have something to ask or tell. */
export class NearestVisitRegionSelector implements VisitRegionSelector {
  public constructor(private readonly config: NearestVisitRegionSelectorConfig) {}

  public select(results: readonly PlaceSummaryDto[]): readonly VisitRegion[] {
    const regions: VisitRegion[] = [];
    const byDistance = [...results].sort(
      (a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity),
    );
    for (const { place, status } of byDistance) {
      const prompt = PROMPTS[status.status];
      if (place.kind !== 'physical' || prompt === null) {
        continue;
      }
      regions.push({
        placeId: place.id,
        name: place.name,
        category: place.category,
        center: place.location,
        radiusM: this.config.radiusM,
        prompt,
      });
      if (regions.length === this.config.maxRegions) {
        break;
      }
    }
    return regions;
  }
}
