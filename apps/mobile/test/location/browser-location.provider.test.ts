import { describe, expect, it, vi } from 'vitest';
import { BrowserLocationProvider } from '../../src/location/browser-location.provider';
import type { BrowserGeolocation } from '../../src/location/location.ports';

const config = { maxAgeMs: 300_000, timeoutMs: 10_000 };

class FakeGeolocation implements BrowserGeolocation {
  public options: unknown = null;

  public constructor(
    private readonly result: { lat: number; lng: number } | 'denied' | 'unanswered',
  ) {}

  public getCurrentPosition(
    onSuccess: (position: { coords: { latitude: number; longitude: number } }) => void,
    onError: (error: unknown) => void,
    options: { maximumAge: number; timeout: number; enableHighAccuracy: boolean },
  ): void {
    this.options = options;
    if (this.result === 'unanswered') {
      return;
    }
    if (this.result === 'denied') {
      onError({ code: 1, message: 'User denied Geolocation' });
    } else {
      onSuccess({ coords: { latitude: this.result.lat, longitude: this.result.lng } });
    }
  }
}

describe('BrowserLocationProvider', () => {
  it('returns the browser position, accepting a cached one', async () => {
    const geolocation = new FakeGeolocation({ lat: 59.91, lng: 10.75 });

    await expect(new BrowserLocationProvider(geolocation, config).findCurrent()).resolves.toEqual({
      lat: 59.91,
      lng: 10.75,
    });
    expect(geolocation.options).toEqual({
      maximumAge: 300_000,
      timeout: 10_000,
      enableHighAccuracy: false,
    });
  });

  it('returns null when the user denies it', async () => {
    await expect(
      new BrowserLocationProvider(new FakeGeolocation('denied'), config).findCurrent(),
    ).resolves.toBeNull();
  });

  it('returns null in a browser without geolocation', async () => {
    await expect(new BrowserLocationProvider(undefined, config).findCurrent()).resolves.toBeNull();
  });

  it('gives up when the permission prompt stays unanswered', async () => {
    vi.useFakeTimers();
    try {
      const found = new BrowserLocationProvider(
        new FakeGeolocation('unanswered'),
        config,
      ).findCurrent();
      await vi.advanceTimersByTimeAsync(10_000);

      await expect(found).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
