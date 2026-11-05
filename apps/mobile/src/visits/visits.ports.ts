import type { PlaceSummaryDto } from '@amexbutikker/contracts';
import type { VisitEvent, VisitPrompt, VisitRegion, VisitState } from './visits.model';

/** Turns on visit detection, keeps the regions current and reacts to region events. */
export interface VisitService {
  isEnabled(): Promise<boolean>;
  /** Asks for notification and background location permission. False when either is denied. */
  enable(): Promise<boolean>;
  disable(): Promise<void>;
  /** Re-selects the monitored regions from a fresh nearby list. Does nothing while disabled. */
  refresh(results: readonly PlaceSummaryDto[]): Promise<void>;
  /** Handles a payload from the OS region task. */
  handle(payload: unknown): Promise<void>;
  /** Shows a sample question for the nearest monitored place. False when there is none. */
  sendTest(): Promise<boolean>;
}

/** Picks which places to watch. */
export interface VisitRegionSelector {
  select(results: readonly PlaceSummaryDto[]): readonly VisitRegion[];
}

/** Decides whether an event leads to a notification. Pure: returns the next state. */
export interface VisitPromptDecider {
  decide(
    state: VisitState,
    event: VisitEvent,
    now: Date,
  ): { readonly state: VisitState; readonly prompt: VisitPrompt | null };
}

export interface VisitStateStorage {
  find(): Promise<VisitState>;
  save(state: VisitState): Promise<void>;
}

/** OS geofencing. */
export interface RegionMonitor {
  /** Foreground, then background ("Always") location permission. */
  requestPermission(): Promise<boolean>;
  start(regions: readonly VisitRegion[]): Promise<void>;
  stop(): Promise<void>;
  /** Reads an OS task payload; null when it is not a region event. */
  toEvent(payload: unknown): VisitEvent | null;
}

/** Local notifications. */
export interface VisitNotifier {
  requestPermission(): Promise<boolean>;
  show(prompt: VisitPrompt): Promise<void>;
}

/** The part of expo-location's geofencing the app uses. */
export interface ExpoGeofencingModule {
  requestForegroundPermissionsAsync(): Promise<{ readonly granted: boolean }>;
  requestBackgroundPermissionsAsync(): Promise<{ readonly granted: boolean }>;
  startGeofencingAsync(
    taskName: string,
    regions: {
      identifier: string;
      latitude: number;
      longitude: number;
      radius: number;
      notifyOnEnter: boolean;
      notifyOnExit: boolean;
    }[],
  ): Promise<void>;
  stopGeofencingAsync(taskName: string): Promise<void>;
  hasStartedGeofencingAsync(taskName: string): Promise<boolean>;
}

/** The part of expo-notifications the app uses. */
export interface ExpoNotificationsModule {
  requestPermissionsAsync(): Promise<{ readonly granted: boolean }>;
  setNotificationCategoryAsync(
    identifier: string,
    actions: {
      identifier: string;
      buttonTitle: string;
      options: { opensAppToForeground: boolean };
    }[],
  ): Promise<unknown>;
  scheduleNotificationAsync(request: {
    content: {
      title: string;
      body: string;
      data: Record<string, string>;
      categoryIdentifier?: string;
    };
    trigger: null;
  }): Promise<string>;
}
