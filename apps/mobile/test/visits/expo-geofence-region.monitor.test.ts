import { describe, expect, it } from 'vitest';
import { ExpoGeofenceRegionMonitor } from '../../src/visits/expo-geofence-region.monitor';
import type { ExpoGeofencingModule } from '../../src/visits/visits.ports';
import { ASK_ID, region } from './visits-test.data';

class FakeGeofencing implements ExpoGeofencingModule {
  public started: { task: string; regions: unknown[] } | null = null;
  public running = false;

  public constructor(
    private readonly foreground: boolean | Error = true,
    private readonly background = true,
  ) {}

  public requestForegroundPermissionsAsync() {
    return this.foreground instanceof Error
      ? Promise.reject(this.foreground)
      : Promise.resolve({ granted: this.foreground });
  }

  public requestBackgroundPermissionsAsync() {
    return Promise.resolve({ granted: this.background });
  }

  public startGeofencingAsync(task: string, regions: unknown[]) {
    this.started = { task, regions };
    this.running = true;
    return Promise.resolve();
  }

  public stopGeofencingAsync() {
    this.running = false;
    return Promise.resolve();
  }

  public hasStartedGeofencingAsync() {
    return Promise.resolve(this.running);
  }
}

const config = { taskName: 'visit-geofence' };

describe('ExpoGeofenceRegionMonitor', () => {
  it.each([
    [true, true, true],
    [false, true, false],
    [true, false, false],
  ])('foreground %s + background %s grants %s', async (foreground, background, expected) => {
    const monitor = new ExpoGeofenceRegionMonitor(
      new FakeGeofencing(foreground, background),
      config,
    );

    await expect(monitor.requestPermission()).resolves.toBe(expected);
  });

  it('treats a failing permission request as denied', async () => {
    const monitor = new ExpoGeofenceRegionMonitor(new FakeGeofencing(new Error('off')), config);

    await expect(monitor.requestPermission()).resolves.toBe(false);
  });

  it('registers one fence per region, named by place id', async () => {
    const location = new FakeGeofencing();

    await new ExpoGeofenceRegionMonitor(location, config).start([region(ASK_ID, 'ask')]);

    expect(location.started).toEqual({
      task: 'visit-geofence',
      regions: [
        {
          identifier: ASK_ID,
          latitude: 59.915,
          longitude: 10.752,
          radius: 75,
          notifyOnEnter: true,
          notifyOnExit: true,
        },
      ],
    });
  });

  it('stops when there is nothing to watch, and stopping twice is harmless', async () => {
    const location = new FakeGeofencing();
    const monitor = new ExpoGeofenceRegionMonitor(location, config);
    await monitor.start([region(ASK_ID, 'ask')]);

    await monitor.start([]);
    await monitor.stop();

    expect(location.running).toBe(false);
  });

  it('reads enter and exit payloads and rejects anything else', () => {
    const monitor = new ExpoGeofenceRegionMonitor(new FakeGeofencing(), config);
    const payload = (eventType: number) => ({ eventType, region: { identifier: ASK_ID } });

    expect(monitor.toEvent(payload(1))).toEqual({ kind: 'enter', placeId: ASK_ID });
    expect(monitor.toEvent(payload(2))).toEqual({ kind: 'exit', placeId: ASK_ID });
    expect(monitor.toEvent(payload(3))).toBeNull();
    expect(monitor.toEvent(undefined)).toBeNull();
  });
});
