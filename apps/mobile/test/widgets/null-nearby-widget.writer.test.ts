import { describe, expect, it } from 'vitest';
import { NullNearbyWidgetWriter } from '../../src/widgets/null-nearby-widget.writer';

describe('NullNearbyWidgetWriter', () => {
  it('does nothing', async () => {
    await expect(new NullNearbyWidgetWriter().save()).resolves.toBeUndefined();
  });
});
