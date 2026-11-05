/**
 * What the "Tar de Amex?" widget shows. Everything is preformatted text and colours: the widget
 * runs outside the app's JavaScript, so it cannot call the presenter or look anything up.
 */
export interface NearbyWidgetProps {
  /**
   * The place the phone is probably at; left out when none is close enough. Never null: the
   * props are stored in UserDefaults, which cannot hold null.
   */
  readonly here?: NearbyWidgetHere;
  /** The nearest places that take or likely take Amex, nearest first; "here" included. */
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
  /** False for "Trolig ja": shown with an outlined symbol. */
  readonly confirmed: boolean;
  /** "40 m". */
  readonly distance: string;
  readonly url: string;
}

export const EMPTY_NEARBY_WIDGET: NearbyWidgetProps = { accepted: [], updated: '' };
