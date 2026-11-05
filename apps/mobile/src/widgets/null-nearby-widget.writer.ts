import type { NearbyWidgetWriter } from './widgets.ports';

/** For platforms without a widget: does nothing on purpose. */
export class NullNearbyWidgetWriter implements NearbyWidgetWriter {
  public save(): Promise<void> {
    return Promise.resolve();
  }
}
