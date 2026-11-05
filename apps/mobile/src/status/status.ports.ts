import type {
  AcceptanceStatus,
  PlaceDetailsResponseDto,
  PlaceCategory,
  PlaceDto,
} from '@amexbutikker/contracts';
import type { StatusView } from './status.model';

/** Turns API data into the UI's sentences. All UI copy about places and statuses lives here. */
export interface StatusPresenter {
  status(status: AcceptanceStatus): StatusView;
  /** Why the app gives this answer, e.g. "Ifølge kredittkort360 (hentet 3. nov. 2026), ikke bekreftet av brukere." */
  basis(details: PlaceDetailsResponseDto): string;
  /** "7 av 9 steder i Rema 1000 tar Amex.", or null without a chain or chain evidence. */
  chainHint(details: PlaceDetailsResponseDto): string | null;
  /** "120 m", "1,4 km", or null without a distance. */
  distance(metres: number | null): string | null;
  /** The street address, or the website's host for an online place; null when unknown. */
  address(place: PlaceDto): string | null;
  /** "Kafé", "Butikk", ... */
  category(category: PlaceCategory): string;
  /** A message for a failed request. */
  error(error: unknown): string;
}
