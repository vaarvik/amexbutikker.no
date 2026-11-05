import type { NearbyWidgetProps } from './widgets.model';
import type { ExpoWidget, NearbyWidgetWriter } from './widgets.ports';

/** Hands the props to the expo-widgets widget, which stores them in the App Group and reloads. */
export class ExpoNearbyWidgetWriter implements NearbyWidgetWriter {
  public constructor(private readonly widget: ExpoWidget<NearbyWidgetProps>) {}

  public save(props: NearbyWidgetProps): Promise<void> {
    this.widget.updateSnapshot(props);
    return Promise.resolve();
  }
}
