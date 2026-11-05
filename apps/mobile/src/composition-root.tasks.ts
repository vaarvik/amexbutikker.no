import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { CompositionRoot } from './composition-root';
import { VISIT_TASK } from './composition-root.platform';

/**
 * Background work, registered when the bundle loads (expo-task-manager requires the global
 * scope). The OS may start the app without UI for a geofence event, so the task builds its own
 * services; visit state lives in storage, not in memory.
 */
TaskManager.defineTask(VISIT_TASK, async ({ data, error }) => {
  if (error !== null) {
    return;
  }
  await CompositionRoot.fromEnv().visits?.handle(data);
});

// Show visit notifications while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
});
