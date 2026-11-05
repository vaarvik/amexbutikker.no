import type { PlaceSummaryDto } from '@amexbutikker/contracts';
import type { NearbyWidgetProps } from './widgets.model';

/** Keeps the home screen widget current. */
export interface NearbyWidgetService {
  /**
   * Shows `results` in the widget. `hereId` is the place the phone just entered; without it the
   * nearest place within reach counts as "here".
   */
  update(results: readonly PlaceSummaryDto[], hereId?: string): Promise<void>;
  /** Re-shows the last nearby list with the place the phone just entered as "here". */
  enter(placeId: string): Promise<void>;
}

/** Turns a nearby list into widget props. Pure. */
export interface NearbyWidgetPropsMapper {
  map(results: readonly PlaceSummaryDto[], hereId: string | null, now: Date): NearbyWidgetProps;
}

/** Hands props to the OS widget. */
export interface NearbyWidgetWriter {
  save(props: NearbyWidgetProps): Promise<void>;
}

/** The part of an expo-widgets `Widget` the app uses. */
export interface ExpoWidget<T extends object> {
  updateSnapshot(props: T): void;
}
