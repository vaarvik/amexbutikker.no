import type {
  Clock,
  CreatePlaceResponseDto,
  GeoPoint,
  MatchSharedResponseDto,
  NearbyPlacesQueryDto,
  PlaceFilterQueryDto,
  PlaceDetailsResponseDto,
  PlaceListResponseDto,
  StatusChangeResponseDto,
} from '@amexbutikker/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import type { LocationProvider } from '../../src/location/location.ports';
import { CachingNearbyService } from '../../src/places/caching-nearby.service';
import type { NearbySnapshot, NearbyState } from '../../src/places/places.model';
import type { NearbyCache, PlacesApiClient } from '../../src/places/places.ports';
import { summary } from '../shared/mobile-test.data';

const here: GeoPoint = { lat: 59.91, lng: 10.75 };
const clock: Clock = { now: () => new Date('2026-11-05T10:00:00.000Z') };
const fresh = [summary({ distanceM: 40 })];
const cached: NearbySnapshot = {
  center: { lat: 59.9, lng: 10.7 },
  fetchedAt: '2026-11-04T08:00:00.000Z',
  results: [summary({ distanceM: 900 })],
};

class StubPlacesApi implements PlacesApiClient {
  public queries: NearbyPlacesQueryDto[] = [];
  public failure: Error | null = null;

  public listNearby(query: NearbyPlacesQueryDto): Promise<PlaceListResponseDto> {
    this.queries.push(query);
    return this.failure === null
      ? Promise.resolve({ results: fresh })
      : Promise.reject(this.failure);
  }

  public search(): Promise<PlaceListResponseDto> {
    return Promise.reject(new Error('not used'));
  }

  public listInArea(): Promise<never> {
    return Promise.reject(new Error('not used'));
  }

  public getDetails(): Promise<PlaceDetailsResponseDto> {
    return Promise.reject(new Error('not used'));
  }

  public create(): Promise<CreatePlaceResponseDto> {
    return Promise.reject(new Error('not used'));
  }

  public submitReport(): Promise<StatusChangeResponseDto> {
    return Promise.reject(new Error('not used'));
  }

  public removeMyReport(): Promise<StatusChangeResponseDto> {
    return Promise.reject(new Error('not used'));
  }

  public matchShared(): Promise<MatchSharedResponseDto> {
    return Promise.reject(new Error('not used'));
  }

  public matchPayment(): Promise<never> {
    return Promise.reject(new Error('not used'));
  }
}

class StubCache implements NearbyCache {
  public saved: NearbySnapshot[] = [];

  public constructor(
    public stored: NearbySnapshot | null = null,
    private readonly broken = false,
  ) {}

  public find(): Promise<NearbySnapshot | null> {
    return this.broken ? Promise.reject(new Error('disk')) : Promise.resolve(this.stored);
  }

  public save(snapshot: NearbySnapshot): Promise<void> {
    if (this.broken) {
      return Promise.reject(new Error('disk'));
    }
    this.saved.push(snapshot);
    return Promise.resolve();
  }
}

class StubLocation implements LocationProvider {
  public constructor(private readonly point: GeoPoint | null) {}

  public findCurrent(): Promise<GeoPoint | null> {
    return Promise.resolve(this.point);
  }
}

async function states(
  service: CachingNearbyService,
  filter: PlaceFilterQueryDto = {},
): Promise<NearbyState[]> {
  const seen: NearbyState[] = [];
  await service.load(filter, (state) => seen.push(state));
  return seen;
}

describe('CachingNearbyService', () => {
  let api: StubPlacesApi;

  beforeEach(() => {
    api = new StubPlacesApi();
  });

  function service(cache: NearbyCache, location: LocationProvider) {
    return new CachingNearbyService(api, cache, location, clock, { radiusM: 1500 });
  }

  it('without a cache: loading, then the fresh list, which it stores', async () => {
    const cache = new StubCache();
    const snapshot = { center: here, fetchedAt: '2026-11-05T10:00:00.000Z', results: fresh };

    await expect(states(service(cache, new StubLocation(here)))).resolves.toEqual([
      { kind: 'loading' },
      { kind: 'ready', snapshot, fromCache: false, refreshing: false },
    ]);
    expect(api.queries).toEqual([{ lat: 59.91, lng: 10.75, radiusM: 1500 }]);
    expect(cache.saved).toEqual([snapshot]);
  });

  it('with a cache: the cached list at once, then the fresh one', async () => {
    const seen = await states(service(new StubCache(cached), new StubLocation(here)));

    expect(seen[0]).toEqual({ kind: 'ready', snapshot: cached, fromCache: true, refreshing: true });
    expect(seen[1]).toMatchObject({
      kind: 'ready',
      fromCache: false,
      snapshot: { results: fresh },
    });
  });

  it('without a position: keeps the cached list and says so', async () => {
    const seen = await states(service(new StubCache(cached), new StubLocation(null)));

    expect(seen.at(-1)).toEqual({ kind: 'no-location', snapshot: cached });
    expect(api.queries).toEqual([]);
  });

  it('when the API fails: keeps the cached list and passes the error on', async () => {
    api.failure = new Error('offline');

    const seen = await states(service(new StubCache(cached), new StubLocation(here)));

    expect(seen.at(-1)).toEqual({ kind: 'failed', error: api.failure, snapshot: cached });
  });

  it('works when the cache can be neither read nor written', async () => {
    const seen = await states(service(new StubCache(null, true), new StubLocation(here)));

    expect(seen.map((state) => state.kind)).toEqual(['loading', 'ready']);
  });

  it('with a filter: skips the cache both ways and passes the filter on', async () => {
    const cache = new StubCache(cached);

    const seen = await states(service(cache, new StubLocation(here)), {
      acceptsOnly: true,
      categories: ['cafe'],
    });

    expect(seen.map((state) => state.kind)).toEqual(['loading', 'ready']);
    expect(api.queries).toEqual([
      { lat: 59.91, lng: 10.75, radiusM: 1500, acceptsOnly: true, categories: ['cafe'] },
    ]);
    expect(cache.saved).toEqual([]);
  });
});
