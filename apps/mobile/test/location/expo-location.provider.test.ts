import { describe, expect, it } from 'vitest';
import { ExpoLocationProvider } from '../../src/location/expo-location.provider';
import type { ExpoLocationModule } from '../../src/location/location.ports';

const config = { maxLastKnownAgeMs: 300_000, requiredAccuracyM: 200, accuracy: 3 };
const at = (latitude: number, longitude: number) => ({ coords: { latitude, longitude } });

class FakeLocation implements ExpoLocationModule {
  public lastKnownOptions: unknown = null;
  public currentOptions: unknown = null;

  public constructor(
    private readonly granted: boolean,
    private readonly lastKnown: ReturnType<typeof at> | null,
    private readonly current: ReturnType<typeof at> | Error,
  ) {}

  public requestForegroundPermissionsAsync() {
    return Promise.resolve({ granted: this.granted });
  }

  public getLastKnownPositionAsync(options: { maxAge: number; requiredAccuracy: number }) {
    this.lastKnownOptions = options;
    return Promise.resolve(this.lastKnown);
  }

  public getCurrentPositionAsync(options: { accuracy: number }) {
    this.currentOptions = options;
    return this.current instanceof Error
      ? Promise.reject(this.current)
      : Promise.resolve(this.current);
  }
}

describe('ExpoLocationProvider', () => {
  it('returns null without asking for a fix when permission is denied', async () => {
    const location = new FakeLocation(false, at(1, 2), at(3, 4));

    await expect(new ExpoLocationProvider(location, config).findCurrent()).resolves.toBeNull();
    expect(location.lastKnownOptions).toBeNull();
  });

  it('uses a fresh last known position and takes no new fix', async () => {
    const location = new FakeLocation(true, at(59.91, 10.75), at(0, 0));

    await expect(new ExpoLocationProvider(location, config).findCurrent()).resolves.toEqual({
      lat: 59.91,
      lng: 10.75,
    });
    expect(location.lastKnownOptions).toEqual({ maxAge: 300_000, requiredAccuracy: 200 });
    expect(location.currentOptions).toBeNull();
  });

  it('takes a new fix when there is no usable last known position', async () => {
    const location = new FakeLocation(true, null, at(59.92, 10.76));

    await expect(new ExpoLocationProvider(location, config).findCurrent()).resolves.toEqual({
      lat: 59.92,
      lng: 10.76,
    });
    expect(location.currentOptions).toEqual({ accuracy: 3 });
  });

  it('returns null when no fix can be had', async () => {
    const location = new FakeLocation(true, null, new Error('Location services are off'));

    await expect(new ExpoLocationProvider(location, config).findCurrent()).resolves.toBeNull();
  });
});
