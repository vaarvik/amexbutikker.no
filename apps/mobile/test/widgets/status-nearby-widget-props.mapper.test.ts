import type { AcceptanceStatus, PlaceId } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { NorwegianStatusPresenter } from '../../src/status/norwegian-status.presenter';
import { StatusNearbyWidgetPropsMapper } from '../../src/widgets/status-nearby-widget-props.mapper';
import { physicalPlace, summary } from '../shared/mobile-test.data';

const id = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}` as PlaceId;
const colors = {
  accepted: '#0A0',
  likely_accepted: '#0A0',
  rejected: '#A00',
  likely_rejected: '#A00',
  mixed: '#AA0',
  unknown: '#555',
};
const mapper = new StatusNearbyWidgetPropsMapper(new NorwegianStatusPresenter(), {
  hereWithinM: 60,
  maxAccepted: 2,
  placeUrl: 'amexbutikker://place/',
  colors,
});
const now = new Date(2026, 10, 5, 9, 7);

function at(n: number, status: AcceptanceStatus, distanceM: number | null) {
  const base = summary();
  return summary({
    place: physicalPlace({ id: id(n), name: `Sted ${String(n)}` }),
    status: { ...base.status, status },
    distanceM,
  });
}

describe('StatusNearbyWidgetPropsMapper', () => {
  it('shows the nearest place within reach as "here", in the app\'s words', () => {
    const props = mapper.map([at(1, 'unknown', 120), at(2, 'unknown', 30)], null, now);

    expect(props.here).toEqual({
      name: 'Sted 2',
      answer: 'Ikke sjekket',
      symbol: 'questionmark.circle',
      color: '#555',
      url: `amexbutikker://place/${id(2)}`,
    });
    expect(props.updated).toBe('Oppdatert 09:07');
  });

  it('prefers the place the phone just entered', () => {
    const props = mapper.map([at(1, 'accepted', 10), at(2, 'rejected', 50)], id(2), now);

    expect(props.here).toMatchObject({
      name: 'Sted 2',
      answer: 'Nei',
      symbol: 'xmark.circle.fill',
    });
  });

  it('leaves "here" out when nothing is close enough, never null (UserDefaults cannot store it)', () => {
    const props = mapper.map([at(1, 'accepted', 61), at(2, 'accepted', null)], null, now);

    expect('here' in props).toBe(false);
    expect(JSON.stringify(props)).not.toContain('null');
  });

  it('lists the nearest accepted places, "here" included, up to the maximum', () => {
    const props = mapper.map(
      [
        at(1, 'accepted', 10),
        at(2, 'accepted', 400),
        at(3, 'unknown', 50),
        at(4, 'accepted', 90),
        at(5, 'accepted', 200),
      ],
      null,
      now,
    );

    expect(props.here?.name).toBe('Sted 1');
    expect(props.accepted).toEqual([
      { name: 'Sted 1', confirmed: true, distance: '10 m', url: `amexbutikker://place/${id(1)}` },
      { name: 'Sted 4', confirmed: true, distance: '90 m', url: `amexbutikker://place/${id(4)}` },
    ]);
  });

  it('shows an empty distance for an accepted place without one', () => {
    const props = mapper.map([at(1, 'accepted', null)], null, now);

    expect(props.accepted).toEqual([
      { name: 'Sted 1', confirmed: true, distance: '', url: `amexbutikker://place/${id(1)}` },
    ]);
  });

  it('lists likely places too, marked as not confirmed, and leaves out the rest', () => {
    const props = mapper.map(
      [at(1, 'likely_accepted', 100), at(2, 'likely_rejected', 50), at(3, 'mixed', 20)],
      null,
      now,
    );

    expect(props.accepted).toEqual([
      { name: 'Sted 1', confirmed: false, distance: '100 m', url: `amexbutikker://place/${id(1)}` },
    ]);
  });
});
