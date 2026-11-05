/**
 * What the "Tar de Amex?" widget shows. Everything is preformatted text and colours: the widget
 * runs outside the app's JavaScript, so it cannot call the presenter or look anything up.
 */
export interface NearbyWidgetProps {
  /** The place the phone is probably at, or null when none is close enough. */
  readonly here: NearbyWidgetHere | null;
  /** The nearest places that take Amex, nearest first, at most three. */
  readonly accepted: readonly NearbyWidgetPlace[];
  /** "Oppdatert 20:15". */
  readonly updated: string;
}

export interface NearbyWidgetHere {
  readonly name: string;
  /** Ja, Nei, Varierer, Ikke sjekket. */
  readonly answer: string;
  /** SF Symbol name. */
  readonly symbol: string;
  /** Status colour as hex. */
  readonly color: string;
  /** Deep link to the place screen. */
  readonly url: string;
}

export interface NearbyWidgetPlace {
  readonly name: string;
  /** "40 m". */
  readonly distance: string;
  readonly url: string;
}

export const EMPTY_NEARBY_WIDGET: NearbyWidgetProps = {
  here: null,
  accepted: [],
  updated: '',
};
