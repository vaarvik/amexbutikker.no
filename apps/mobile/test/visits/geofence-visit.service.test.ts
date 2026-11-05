import type { Clock, PlaceSummaryDto } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { GeofenceVisitService } from '../../src/visits/geofence-visit.service';
import { KeyValueVisitStateStorage } from '../../src/visits/key-value-visit-state.storage';
import type {
  VisitEvent,
  VisitPrompt,
  VisitRegion,
  VisitState,
} from '../../src/visits/visits.model';
import type {
  RegionMonitor,
  VisitNotifier,
  VisitPromptDecider,
  VisitRegionSelector,
} from '../../src/visits/visits.ports';
import { MapKeyValueStorage, summary } from '../shared/mobile-test.data';
import { ANNOUNCE_ID, ASK_ID, enabledState, region } from './visits-test.data';

const NOW = new Date('2026-11-05T12:00:00.000Z');

class FakeMonitor implements RegionMonitor {
  public watching: readonly VisitRegion[] | null = null;
  public constructor(public granted = true) {}
  public requestPermission() {
    return Promise.resolve(this.granted);
  }
  public start(regions: readonly VisitRegion[]) {
    this.watching = regions;
    return Promise.resolve();
  }
  public stop() {
    this.watching = null;
    return Promise.resolve();
  }
  public toEvent(payload: unknown): VisitEvent | null {
    return typeof payload === 'object' && payload !== null ? (payload as VisitEvent) : null;
  }
}

class FakeNotifier implements VisitNotifier {
  public shown: VisitPrompt[] = [];
  public constructor(public granted = true) {}
  public requestPermission() {
    return Promise.resolve(this.granted);
  }
  public show(prompt: VisitPrompt) {
    this.shown.push(prompt);
    return Promise.resolve();
  }
}

class FixedSelector implements VisitRegionSelector {
  public constructor(private readonly regions: readonly VisitRegion[]) {}
  public select(): readonly VisitRegion[] {
    return this.regions;
  }
}

/** Asks on every exit; records the event in enteredAt so the test can see the state flow. */
class EveryExitDecider implements VisitPromptDecider {
  public decide(state: VisitState, event: VisitEvent) {
    const next = {
      ...state,
      enteredAt: { ...state.enteredAt, [event.placeId]: NOW.toISOString() },
    };
    return {
      state: next,
      prompt:
        event.kind === 'exit'
          ? ({ kind: 'ask', placeId: ASK_ID, name: 'Kafé Åsen' } as const)
          : null,
    };
  }
}

const clock: Clock = { now: () => NOW };

function setup(initial?: VisitState, regions = [region(ASK_ID, 'ask')]) {
  const values = new MapKeyValueStorage();
  const storage = new KeyValueVisitStateStorage(values, { key: 'visits' });
  const monitor = new FakeMonitor();
  const notifier = new FakeNotifier();
  const service = new GeofenceVisitService(
    monitor,
    notifier,
    new FixedSelector(regions),
    new EveryExitDecider(),
    storage,
    clock,
  );
  const ready = initial === undefined ? Promise.resolve() : storage.save(initial);
  return { service, storage, monitor, notifier, ready };
}

const results: readonly PlaceSummaryDto[] = [summary()];

describe('GeofenceVisitService', () => {
  it('is off until enabled', async () => {
    const { service } = setup();

    await expect(service.isEnabled()).resolves.toBe(false);
    await expect(service.enable()).resolves.toBe(true);
    await expect(service.isEnabled()).resolves.toBe(true);
  });

  it('stays off when notifications or location are not allowed', async () => {
    const noNotifications = setup();
    noNotifications.notifier.granted = false;
    const noLocation = setup();
    noLocation.monitor.granted = false;

    await expect(noNotifications.service.enable()).resolves.toBe(false);
    await expect(noLocation.service.enable()).resolves.toBe(false);
    await expect(noLocation.service.isEnabled()).resolves.toBe(false);
  });

  it('watches the selected regions after a refresh, but only while enabled', async () => {
    const { service, monitor } = setup();

    await service.refresh(results);
    expect(monitor.watching).toBeNull();

    await service.enable();
    await service.refresh(results);
    expect(monitor.watching).toEqual([region(ASK_ID, 'ask')]);
  });

  it('keeps enter times only for regions that are still watched', async () => {
    const inside = { [ASK_ID]: NOW.toISOString(), [ANNOUNCE_ID]: NOW.toISOString() };
    const { service, storage, ready } = setup(enabledState({ enteredAt: inside }));
    await ready;

    await service.refresh(results);

    expect((await storage.find()).enteredAt).toEqual({ [ASK_ID]: NOW.toISOString() });
  });

  it('shows the decided prompt and stores the new state', async () => {
    const { service, notifier, storage, ready } = setup(enabledState());
    await ready;

    await service.handle({ kind: 'enter', placeId: ASK_ID });
    await service.handle({ kind: 'exit', placeId: ASK_ID });

    expect(notifier.shown).toEqual([{ kind: 'ask', placeId: ASK_ID, name: 'Kafé Åsen' }]);
    expect((await storage.find()).enteredAt[ASK_ID]).toBe(NOW.toISOString());
  });

  it('ignores payloads that are not region events, and events while disabled', async () => {
    const { service, notifier } = setup(enabledState({ enabled: false }));

    await service.handle('not an event');
    await service.handle({ kind: 'exit', placeId: ASK_ID });

    expect(notifier.shown).toEqual([]);
  });

  it('forgets regions and visits when disabled, but keeps the rate limits', async () => {
    const asked = { [ASK_ID]: NOW.toISOString() };
    const { service, monitor, storage, ready } = setup(
      enabledState({ askedAt: asked, recentAsks: [NOW.toISOString()] }),
    );
    await ready;
    await service.refresh(results);

    await service.disable();

    expect(monitor.watching).toBeNull();
    expect(await storage.find()).toMatchObject({
      enabled: false,
      regions: [],
      enteredAt: {},
      askedAt: asked,
      recentAsks: [NOW.toISOString()],
    });
  });

  it('sends a test question for the nearest place it would ask about', async () => {
    const { service, notifier, ready } = setup(enabledState());
    await ready;

    await expect(service.sendTest()).resolves.toBe(true);
    expect(notifier.shown).toEqual([{ kind: 'ask', placeId: ASK_ID, name: 'Kafé Åsen' }]);
  });

  it('has no test question when it watches nothing to ask about', async () => {
    const { service, ready } = setup(enabledState({ regions: [region(ANNOUNCE_ID, 'announce')] }));
    await ready;

    await expect(service.sendTest()).resolves.toBe(false);
  });
});
