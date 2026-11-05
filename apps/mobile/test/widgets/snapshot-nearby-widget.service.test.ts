import type { Clock, PlaceSummaryDto } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import type { NearbySnapshot } from '../../src/places/places.model';
import type { NearbyCache } from '../../src/places/places.ports';
import { SnapshotNearbyWidgetService } from '../../src/widgets/snapshot-nearby-widget.service';
import { EMPTY_NEARBY_WIDGET } from '../../src/widgets/widgets.model';
import type { NearbyWidgetProps } from '../../src/widgets/widgets.model';
import type { NearbyWidgetPropsMapper, NearbyWidgetWriter } from '../../src/widgets/widgets.ports';
import { PLACE_ID, summary } from '../shared/mobile-test.data';

const NOW = new Date('2026-11-05T12:00:00.000Z');
const clock: Clock = { now: () => NOW };
const results: readonly PlaceSummaryDto[] = [summary()];

class RecordingMapper implements NearbyWidgetPropsMapper {
  public calls: { count: number; hereId: string | null; now: Date }[] = [];
  public map(input: readonly PlaceSummaryDto[], hereId: string | null, now: Date) {
    this.calls.push({ count: input.length, hereId, now });
    return EMPTY_NEARBY_WIDGET;
  }
}

class RecordingWriter implements NearbyWidgetWriter {
  public saved: NearbyWidgetProps[] = [];
  public constructor(private readonly fails = false) {}
  public save(props: NearbyWidgetProps) {
    this.saved.push(props);
    return this.fails ? Promise.reject(new Error('no widget')) : Promise.resolve();
  }
}

class StubCache implements NearbyCache {
  public constructor(private readonly snapshot: NearbySnapshot | null | Error) {}
  public find() {
    return this.snapshot instanceof Error
      ? Promise.reject(this.snapshot)
      : Promise.resolve(this.snapshot);
  }
  public save() {
    return Promise.resolve();
  }
}

const snapshot: NearbySnapshot = {
  center: { lat: 59.9, lng: 10.7 },
  fetchedAt: NOW.toISOString(),
  results,
};

describe('SnapshotNearbyWidgetService', () => {
  it('maps the list and writes it to the widget', async () => {
    const mapper = new RecordingMapper();
    const writer = new RecordingWriter();

    await new SnapshotNearbyWidgetService(mapper, writer, new StubCache(null), clock).update(
      results,
    );

    expect(mapper.calls).toEqual([{ count: 1, hereId: null, now: NOW }]);
    expect(writer.saved).toEqual([EMPTY_NEARBY_WIDGET]);
  });

  it('never lets a widget failure reach the caller', async () => {
    const service = new SnapshotNearbyWidgetService(
      new RecordingMapper(),
      new RecordingWriter(true),
      new StubCache(null),
      clock,
    );

    await expect(service.update(results)).resolves.toBeUndefined();
  });

  it('on entering a place, re-shows the cached list with that place as "here"', async () => {
    const mapper = new RecordingMapper();

    await new SnapshotNearbyWidgetService(
      mapper,
      new RecordingWriter(),
      new StubCache(snapshot),
      clock,
    ).enter(PLACE_ID);

    expect(mapper.calls).toEqual([{ count: 1, hereId: PLACE_ID, now: NOW }]);
  });

  it.each([[null], [new Error('unreadable')]])(
    'does nothing on entering without a cached list (%s)',
    async (cached) => {
      const writer = new RecordingWriter();

      await new SnapshotNearbyWidgetService(
        new RecordingMapper(),
        writer,
        new StubCache(cached),
        clock,
      ).enter(PLACE_ID);

      expect(writer.saved).toEqual([]);
    },
  );
});
