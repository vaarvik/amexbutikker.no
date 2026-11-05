import type { AcceptanceStatus, PlaceSummaryDto } from '@amexbutikker/contracts';
import type { StatusPresenter } from '../status/status.ports';
import type { NearbyWidgetProps } from './widgets.model';
import type { NearbyWidgetPropsMapper } from './widgets.ports';

export interface StatusNearbyWidgetPropsMapperConfig {
  /** Without an entered place, the nearest place this close counts as "here". */
  readonly hereWithinM: number;
  readonly maxAccepted: number;
  /** Prefix of the place deep link, e.g. `amexbutikker://place/`. */
  readonly placeUrl: string;
  readonly colors: Readonly<Record<AcceptanceStatus, string>>;
}

const SYMBOLS: Readonly<Record<AcceptanceStatus, string>> = {
  accepted: 'checkmark.circle.fill',
  rejected: 'xmark.circle.fill',
  mixed: 'plusminus.circle.fill',
  unknown: 'questionmark.circle',
};

/** Uses the presenter's words, so the widget says exactly what the app says. */
export class StatusNearbyWidgetPropsMapper implements NearbyWidgetPropsMapper {
  public constructor(
    private readonly presenter: StatusPresenter,
    private readonly config: StatusNearbyWidgetPropsMapperConfig,
  ) {}

  public map(
    results: readonly PlaceSummaryDto[],
    hereId: string | null,
    now: Date,
  ): NearbyWidgetProps {
    const byDistance = [...results].sort(
      (a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity),
    );
    const here =
      (hereId === null ? undefined : results.find((r) => r.place.id === hereId)) ??
      byDistance.find((r) => r.distanceM !== null && r.distanceM <= this.config.hereWithinM);
    const status = here?.status.status;
    return {
      here:
        here === undefined || status === undefined
          ? null
          : {
              name: here.place.name,
              answer: this.presenter.status(status).answer,
              symbol: SYMBOLS[status],
              color: this.config.colors[status],
              url: this.url(here.place.id),
            },
      accepted: byDistance
        .filter((r) => r.status.status === 'accepted' && r.place.id !== here?.place.id)
        .slice(0, this.config.maxAccepted)
        .map((r) => ({
          name: r.place.name,
          distance: this.presenter.distance(r.distanceM) ?? '',
          url: this.url(r.place.id),
        })),
      updated: `Oppdatert ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    };
  }

  private url(placeId: string): string {
    return `${this.config.placeUrl}${placeId}`;
  }
}
