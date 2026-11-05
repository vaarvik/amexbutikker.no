import { PlaceIdSchema } from '@amexbutikker/contracts';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useServices } from './services';

/**
 * Handles taps on visit notifications. "Det funket" / "Ble avvist" send the report, then open
 * the place; a plain tap opens the place; "Prøvde ikke" opens nothing. A list of likely places
 * opens the pick screen. Renders nothing.
 * Native only: the root layout leaves it out on the web.
 */
export function VisitNotificationRouter() {
  const { places } = useServices();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (response === null || response === undefined) {
      return;
    }
    const id = response.notification.request.identifier;
    if (handled.current === id) {
      return;
    }
    handled.current = id;
    Notifications.clearLastNotificationResponse();

    const data = response.notification.request.content.data;
    if (data?.kind === 'pick' && typeof data.candidates === 'string') {
      router.push({ pathname: '/visit', params: { candidates: data.candidates } });
      return;
    }
    const placeId = PlaceIdSchema.safeParse(data?.placeId);
    if (!placeId.success) {
      return;
    }
    const open = () => {
      router.push({ pathname: '/place/[id]', params: { id: placeId.data } });
    };
    const action = response.actionIdentifier;
    if (action === 'accepted' || action === 'rejected') {
      // The place screen shows the result either way; a failed send leaves the buttons there.
      places
        .submitReport(placeId.data, { result: action })
        .catch(() => undefined)
        .finally(open);
    } else if (action === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      open();
    }
  }, [response, places]);

  return null;
}
