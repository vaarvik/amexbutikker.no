import { describe, expect, it } from 'vitest';
import { ExpoVisitNotifier } from '../../src/visits/expo-visit.notifier';
import type { ExpoNotificationsModule } from '../../src/visits/visits.ports';
import { ANNOUNCE_ID, ASK_ID, candidate } from './visits-test.data';

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
      candidate: candidate(ASK_ID),
    });

    expect(notifications.scheduled).toEqual([
      {
        content: {
          title: 'Betalte du med Amex hos Kafé Åsen?',
          body: 'Svaret ditt hjelper neste person.',
          data: { kind: 'ask', placeId: ASK_ID },
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
      candidate: candidate(ASK_ID, 'Bar Boka'),
    });

    expect(notifications.scheduled).toEqual([
      {
        content: {
          title: 'Her kan du betale med Amex',
          body: 'Bar Boka tar Amex, ifølge appen.',
          data: { kind: 'announce', placeId: ASK_ID },
        },
        trigger: null,
      },
    ]);
  });

  it.each([
    [['A', 'B'], 'Var du hos A eller B? Trykk for å svare.'],
    [['A', 'B', 'C'], 'Var du hos A, B eller C? Trykk for å svare.'],
    [['A', 'B', 'C', 'D'], 'Var du hos A, B, C eller et annet sted i nærheten? Trykk for å svare.'],
  ])('lists the places %j without buttons', async (names, body) => {
    const notifications = new FakeNotifications();
    const candidates = names.map((name, i) => candidate(i === 0 ? ASK_ID : ANNOUNCE_ID, name));

    await new ExpoVisitNotifier(notifications, config).show({ kind: 'pick', candidates });

    expect(notifications.scheduled).toEqual([
      {
        content: {
          title: 'Betalte du med Amex nå nettopp?',
          body,
          data: { kind: 'pick', candidates: JSON.stringify(candidates) },
        },
        trigger: null,
      },
    ]);
  });
});
