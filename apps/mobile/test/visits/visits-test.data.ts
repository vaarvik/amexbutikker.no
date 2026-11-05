import type { PlaceId } from '@amexbutikker/contracts';
import { EMPTY_VISIT_STATE } from '../../src/visits/visits.model';
import type { VisitPromptKind, VisitRegion, VisitState } from '../../src/visits/visits.model';

export const ASK_ID = '0190a000-0000-7000-8000-0000000000a1' as PlaceId;
export const ANNOUNCE_ID = '0190a000-0000-7000-8000-0000000000a2' as PlaceId;

export function region(placeId: PlaceId, prompt: VisitPromptKind, name = 'Kafé Åsen'): VisitRegion {
  return { placeId, name, center: { lat: 59.915, lng: 10.752 }, radiusM: 75, prompt };
}

export function enabledState(overrides: Partial<VisitState> = {}): VisitState {
  return {
    ...EMPTY_VISIT_STATE,
    enabled: true,
    regions: [region(ASK_ID, 'ask'), region(ANNOUNCE_ID, 'announce', 'Bar Boka')],
    ...overrides,
  };
}
