import { describe, expect, it } from 'vitest';
import { ExpoVisitNotifier } from '../../src/visits/expo-visit.notifier';
import type { ExpoNotificationsModule } from '../../src/visits/visits.ports';
import { ASK_ID } from './visits-test.data';

class FakeNotifications implements ExpoNotificationsModule {
  public categories: { id: string; actions: unknown[] }[] = [];
  public scheduled: unknown[] = [];

  public constructor(private readonly granted: boolean | Error = true) {}

  public requestPermissionsAsync() {
    return this.granted instanceof Error
      ? Promise.reject(this.granted)
      : Promise.resolve({ granted: this.granted });
  }

  public setNotificationCategoryAsync(id: string, actions: unknown[]) {
    this.categories.push({ id, actions });
    return Promise.resolve(null);
  }

  public scheduleNotificationAsync(request: unknown) {
    this.scheduled.push(request);
    return Promise.resolve('n1');
  }
}

const config = { askCategory: 'visit-ask' };

describe('ExpoVisitNotifier', () => {
  it('sets up the answer buttons once permission is granted', async () => {
    const notifications = new FakeNotifications();

    await expect(new ExpoVisitNotifier(notifications, config).requestPermission()).resolves.toBe(
      true,
    );

    expect(notifications.categories).toEqual([
      {
        id: 'visit-ask',
        actions: [
          {
            identifier: 'accepted',
            buttonTitle: 'Det funket',
            options: { opensAppToForeground: true },
          },
          {
            identifier: 'rejected',
            buttonTitle: 'Ble avvist',
            options: { opensAppToForeground: true },
          },
          {
            identifier: 'skipped',
            buttonTitle: 'Prøvde ikke',
            options: { opensAppToForeground: false },
          },
        ],
      },
    ]);
  });

  it.each([[false], [new Error('unavailable')]])('reports %s as no permission', async (granted) => {
    const notifications = new FakeNotifications(granted);

    await expect(new ExpoVisitNotifier(notifications, config).requestPermission()).resolves.toBe(
      false,
    );
    expect(notifications.categories).toEqual([]);
  });

  it('asks with the answer buttons', async () => {
    const notifications = new FakeNotifications();

    await new ExpoVisitNotifier(notifications, config).show({
      kind: 'ask',
      placeId: ASK_ID,
      name: 'Kafé Åsen',
    });

    expect(notifications.scheduled).toEqual([
      {
        content: {
          title: 'Betalte du med Amex hos Kafé Åsen?',
          body: 'Trykk og hold for å svare. Svaret hjelper neste person.',
          data: { placeId: ASK_ID, kind: 'ask' },
          categoryIdentifier: 'visit-ask',
        },
        trigger: null,
      },
    ]);
  });

  it('announces without buttons', async () => {
    const notifications = new FakeNotifications();

    await new ExpoVisitNotifier(notifications, config).show({
      kind: 'announce',
      placeId: ASK_ID,
      name: 'Bar Boka',
    });

    expect(notifications.scheduled).toEqual([
      {
        content: {
          title: 'Her kan du betale med Amex',
          body: 'Bar Boka tar Amex, ifølge appen.',
          data: { placeId: ASK_ID, kind: 'announce' },
        },
        trigger: null,
      },
    ]);
  });
});
