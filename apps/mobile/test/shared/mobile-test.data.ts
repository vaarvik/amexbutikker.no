import type {
  ChainId,
  PlaceDetailsResponseDto,
  PlaceDto,
  PlaceId,
  PlaceSummaryDto,
  StatusBasisDto,
} from '@amexbutikker/contracts';
import type { KeyValueStorage } from '../../src/shared/shared.ports';

export const PLACE_ID = '0190a000-0000-7000-8000-000000000001' as PlaceId;
export const CHAIN_ID = '0190a000-0000-7000-8000-0000000000c1' as ChainId;

export function physicalPlace(overrides: Partial<Extract<PlaceDto, { kind: 'physical' }>> = {}) {
  return {
    kind: 'physical',
    id: PLACE_ID,
    name: 'Kafé Åsen',
    category: 'cafe',
    website: null,
    chainId: null,
    address: { street: 'Torggata 5', postcode: '0181', city: 'Oslo' },
    location: { lat: 59.915, lng: 10.752 },
    ...overrides,
  } satisfies PlaceDto;
}

export function summary(overrides: Partial<PlaceSummaryDto> = {}): PlaceSummaryDto {
  return {
    place: physicalPlace(),
    status: {
      status: 'accepted',
      confidence: 0.6,
      basis: 'user_report',
      verified: false,
      lastEvidenceAt: '2026-11-03T12:00:00.000Z',
    },
    distanceM: 120,
    ...overrides,
  };
}

export function details(
  basis: Partial<StatusBasisDto> = {},
  overrides: Partial<PlaceDetailsResponseDto> = {},
): PlaceDetailsResponseDto {
  return {
    place: physicalPlace(),
    status: summary().status,
    basis: {
      kind: 'user_report',
      scope: 'place',
      source: null,
      observedAt: '2026-11-03T12:00:00.000Z',
      userAccepted: 2,
      userRejected: 0,
      ...basis,
    },
    chain: null,
    chainHint: null,
    latestNotes: [],
    myReport: null,
    ...overrides,
  };
}

/** KeyValueStorage in a Map, for tests. */
export class MapKeyValueStorage implements KeyValueStorage {
  public readonly values = new Map<string, string>();

  public getItem(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  public setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }

  public removeItem(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }
}
