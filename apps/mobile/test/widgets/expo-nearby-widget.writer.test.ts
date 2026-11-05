import { describe, expect, it } from 'vitest';
import { ExpoNearbyWidgetWriter } from '../../src/widgets/expo-nearby-widget.writer';
import { EMPTY_NEARBY_WIDGET } from '../../src/widgets/widgets.model';
import type { NearbyWidgetProps } from '../../src/widgets/widgets.model';

describe('ExpoNearbyWidgetWriter', () => {
  it('hands the props to the widget snapshot', async () => {
    const snapshots: NearbyWidgetProps[] = [];

    await new ExpoNearbyWidgetWriter({ updateSnapshot: (props) => snapshots.push(props) }).save(
      EMPTY_NEARBY_WIDGET,
    );

    expect(snapshots).toEqual([EMPTY_NEARBY_WIDGET]);
  });
});
