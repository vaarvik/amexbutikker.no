import { z } from 'zod';
import type { VisitEvent, VisitRegion } from './visits.model';
import type { ExpoGeofencingModule, RegionMonitor } from './visits.ports';

export interface ExpoGeofenceRegionMonitorConfig {
  /** The task registered with expo-task-manager in `composition-root.tasks.ts`. */
  readonly taskName: string;
}

/** `Location.LocationGeofencingEventType`: Enter = 1, Exit = 2. */
const PayloadSchema = z.object({
  eventType: z.union([z.literal(1), z.literal(2)]),
  region: z.object({ identifier: z.string() }),
});

/** Geofencing through expo-location; the OS wakes the app with each enter and exit. */
export class ExpoGeofenceRegionMonitor implements RegionMonitor {
  public constructor(
    private readonly location: ExpoGeofencingModule,
    private readonly config: ExpoGeofenceRegionMonitorConfig,
  ) {}

  public async requestPermission(): Promise<boolean> {
    try {
      const foreground = await this.location.requestForegroundPermissionsAsync();
      if (!foreground.granted) {
        return false;
      }
      return (await this.location.requestBackgroundPermissionsAsync()).granted;
    } catch {
      return false;
    }
  }

  public async start(regions: readonly VisitRegion[]): Promise<void> {
    if (regions.length === 0) {
      await this.stop();
      return;
    }
    // Starting again replaces the task's regions.
    await this.location.startGeofencingAsync(
      this.config.taskName,
      regions.map((region) => ({
        identifier: region.placeId,
        latitude: region.center.lat,
        longitude: region.center.lng,
        radius: region.radiusM,
        notifyOnEnter: true,
        notifyOnExit: true,
      })),
    );
  }

  public async stop(): Promise<void> {
    if (await this.location.hasStartedGeofencingAsync(this.config.taskName)) {
      await this.location.stopGeofencingAsync(this.config.taskName);
    }
  }

  public toEvent(payload: unknown): VisitEvent | null {
    const parsed = PayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return null;
    }
    return {
      kind: parsed.data.eventType === 1 ? 'enter' : 'exit',
      placeId: parsed.data.region.identifier,
    };
  }
}
