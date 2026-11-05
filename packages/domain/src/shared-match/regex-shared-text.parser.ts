import { SHARED_TEXT_MAX_LENGTH, ValidationError } from '@amexbutikker/contracts';
import type {
  GeoPoint,
  ParsedSharedPlace,
  SharedPlaceProvider,
  SharedTextParser,
} from '@amexbutikker/contracts';

const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;
/** "0155 Oslo", "N-0155 Oslo", "NO-0155 Oslo". */
const POSTCODE_CITY = /^(?:NO?-)?(\d{4})\s+(\p{L}[\p{L}\s.'-]*)$/u;
const COORDINATES = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/;
/** Google's "@59.92,10.75,17z" in a place link. */
const GOOGLE_AT = /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/;
/** Rating and category lines Google adds on Android ("★★★★★ · Kafé"). */
const NOISE = /[★·]/;

interface Address {
  readonly street: string | null;
  readonly postcode: string;
  readonly city: string | null;
  /** Text before the street on the same line: "Name, Street 1, 0155 Oslo". */
  readonly before: string | null;
}

/** What a maps link tells about the place. */
interface LinkDetails {
  readonly name: string | null;
  readonly location: GeoPoint | null;
  readonly address: string | null;
}

const NO_DETAILS: LinkDetails = { name: null, location: null, address: null };

/**
 * Reads the text Google Maps and Apple Maps put on the share sheet, in Norwegian and English:
 * a name line, an address line ("Street 1, 0155 Oslo, Norge") and a link. Apple links carry the
 * name (`q`), the address and the coordinates (`ll`); Google place links carry name and `@lat,lng`.
 * Short links (maps.app.goo.gl) carry nothing readable and are only collected.
 */
export class RegexSharedTextParser implements SharedTextParser {
  public parse(text: string): ParsedSharedPlace {
    const trimmed = text.trim();
    if (trimmed === '' || trimmed.length > SHARED_TEXT_MAX_LENGTH) {
      throw new ValidationError(
        `Shared text must be 1..${String(SHARED_TEXT_MAX_LENGTH)} characters.`,
        [{ path: ['text'], message: 'empty or too long' }],
      );
    }

    const urls = [...trimmed.matchAll(URL_PATTERN)]
      .map(([url]) => url.replace(/[).,;]+$/, ''))
      .filter((url) => URL.canParse(url));
    const link = urls.map((url) => this.linkDetails(url)).find((details) => details !== null);
    const details = link ?? NO_DETAILS;
    const lines = trimmed
      .replace(URL_PATTERN, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !NOISE.test(line));

    const address =
      this.firstAddress(lines) ?? (details.address === null ? null : this.address(details.address));
    const nameLine = lines.find((line) => this.address(line) === null && !COORDINATES.test(line));

    return {
      provider: this.provider(urls),
      // A line of its own is the name; text before the address only counts on a one-line share.
      name: this.clean(details.name ?? nameLine ?? address?.before ?? null),
      street: address?.street ?? null,
      postcode: address?.postcode ?? null,
      city: address?.city ?? null,
      location: details.location ?? this.coordinates(lines.join(' ')),
      urls,
    };
  }

  private provider(urls: readonly string[]): SharedPlaceProvider {
    for (const url of urls) {
      const { host, pathname } = new URL(url);
      if (host === 'maps.apple.com' || host === 'maps.apple') {
        return 'apple_maps';
      }
      if (
        host === 'maps.app.goo.gl' ||
        host === 'goo.gl' ||
        (/(^|\.)google\.[a-z.]+$/.test(host) && pathname.startsWith('/maps'))
      ) {
        return 'google_maps';
      }
    }
    return 'unknown';
  }

  /** Details from an Apple or Google link, or null for any other link. */
  private linkDetails(url: string): LinkDetails | null {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    if (parsed.host === 'maps.apple.com' || parsed.host === 'maps.apple') {
      return {
        name: params.get('q') ?? params.get('name'),
        location: this.coordinates(params.get('ll') ?? params.get('coordinate') ?? ''),
        address: params.get('address'),
      };
    }
    const place = /\/maps\/place\/([^/]+)/.exec(parsed.pathname)?.[1];
    if (place !== undefined) {
      const at = GOOGLE_AT.exec(parsed.pathname);
      return {
        name: decodeURIComponent(place.replace(/\+/g, ' ')),
        location: at === null ? null : this.point(at[1], at[2]),
        address: null,
      };
    }
    const query = params.get('q') ?? params.get('query');
    if (query !== null && parsed.host.includes('google.')) {
      const location = this.coordinates(query);
      return location === null
        ? { name: query.replace(/,.*$/, ''), location: null, address: query }
        : { name: null, location, address: null };
    }
    return null;
  }

  private firstAddress(lines: readonly string[]): Address | null {
    for (const line of lines) {
      const address = this.address(line);
      if (address !== null) {
        return address;
      }
    }
    return null;
  }

  /** Finds "postcode city" among the comma-separated parts of a line. */
  private address(line: string): Address | null {
    const parts = line.split(',').map((part) => part.trim());
    const index = parts.findIndex((part) => POSTCODE_CITY.test(part));
    const match = POSTCODE_CITY.exec(parts[index] ?? '');
    if (match === null) {
      return null;
    }
    const candidate = parts[index - 1];
    const street =
      candidate !== undefined && /\p{L}/u.test(candidate) && /\d/.test(candidate)
        ? candidate
        : null;
    const before = parts.slice(0, street === null ? index : index - 1).join(', ');
    return {
      street,
      // Both groups always take part in a match.
      postcode: String(match[1]),
      city: this.clean(String(match[2])),
      before: before === '' ? null : before,
    };
  }

  private coordinates(text: string): GeoPoint | null {
    const match = COORDINATES.exec(text);
    return match === null ? null : this.point(match[1], match[2]);
  }

  private point(lat: string | undefined, lng: string | undefined): GeoPoint | null {
    const point = { lat: Number(lat), lng: Number(lng) };
    return Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 ? point : null;
  }

  /** Trims, collapses whitespace and drops a lead-in such as "Sjekk denne:". */
  private clean(value: string | null): string | null {
    if (value === null) {
      return null;
    }
    const text = value.replace(/\s+/g, ' ').trim();
    // Lines and parts are trimmed and non-empty, so neither result is empty.
    return text.includes(': ') ? text.slice(text.lastIndexOf(': ') + 2) : text;
  }
}
