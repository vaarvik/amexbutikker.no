import type { NearbyWidgetProps } from '../widgets/widgets.model';
import type { ExpoWidget } from '../widgets/widgets.ports';

/** No home screen widget on Android and the web yet; `nearby-widget.ios.tsx` is the iOS one. */
export const nearbyWidget: ExpoWidget<NearbyWidgetProps> | null = null;
