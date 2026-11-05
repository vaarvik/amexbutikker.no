import type {
  AcceptanceStatus,
  PlaceDetailsResponseDto,
  PlaceCategory,
  PlaceDto,
} from '@amexbutikker/contracts';
import { ApiError } from '../shared/fetch-json.transport';
import type { StatusView } from './status.model';
import type { StatusPresenter } from './status.ports';

const VIEWS: Readonly<Record<AcceptanceStatus, StatusView>> = {
  accepted: { status: 'accepted', answer: 'Ja', label: 'Tar Amex', symbol: '✓' },
  rejected: { status: 'rejected', answer: 'Nei', label: 'Tar ikke Amex', symbol: '✕' },
  mixed: {
    status: 'mixed',
    answer: 'Varierer',
    label: 'Noen har fått betale, andre ikke',
    symbol: '±',
  },
  unknown: { status: 'unknown', answer: 'Ukjent', label: 'Ingen vet ennå', symbol: '?' },
};

const MONTHS = [
  'jan.',
  'feb.',
  'mars',
  'april',
  'mai',
  'juni',
  'juli',
  'aug.',
  'sep.',
  'okt.',
  'nov.',
  'des.',
];

const CATEGORIES: Readonly<Record<PlaceCategory, string>> = {
  restaurant: 'Restaurant',
  cafe: 'Kafé',
  bar: 'Bar',
  pub: 'Pub',
  fast_food: 'Gatekjøkken',
  shop: 'Butikk',
  hotel: 'Hotell',
  online_shop: 'Nettbutikk',
  other: 'Annet',
};

const ERRORS: Readonly<Record<string, string>> = {
  unreachable: 'Får ikke kontakt med serveren. Sjekk nettet og prøv igjen.',
  rate_limited: 'Du har sendt mange rapporter på kort tid. Prøv igjen om litt.',
  not_found: 'Fant ikke stedet. Det kan være fjernet.',
  validation_failed: 'Noe av det du fylte inn er ikke gyldig.',
};

/** Bokmål copy. Dates are formatted by hand, so the output does not depend on Intl support. */
export class NorwegianStatusPresenter implements StatusPresenter {
  public status(status: AcceptanceStatus): StatusView {
    return VIEWS[status];
  }

  public basis(details: PlaceDetailsResponseDto): string {
    const { basis } = details;
    const source = basis.source ?? 'en ekstern liste';
    const date = basis.observedAt === null ? null : this.date(basis.observedAt);
    switch (basis.kind) {
      case 'transaction':
        return `Bekreftet med kjøp${this.on(date)}.`;
      case 'visit_report':
        return `Bekreftet ved besøk${this.on(date)}.`;
      case 'user_report':
        return this.userReports(basis.userAccepted, basis.userRejected, date);
      case 'chain_confirmation':
        return `Ifølge ${source} gjelder dette hele ${details.chain?.name ?? 'kjeden'}. Ikke bekreftet av brukere her.`;
      case 'external_list':
        return `Ifølge ${source}${date === null ? '' : ` (hentet ${date})`}, ikke bekreftet av brukere.`;
      case 'checkout_logo':
        return `Amex-logo i kassen ifølge ${source}, ikke bekreftet av brukere.`;
      case null:
        return 'Ingen har rapportert om dette stedet ennå.';
    }
  }

  public chainHint(details: PlaceDetailsResponseDto): string | null {
    const { chain, chainHint } = details;
    if (chain === null || chainHint === null || chainHint.totalWithEvidence === 0) {
      return null;
    }
    return `${String(chainHint.acceptedCount)} av ${String(chainHint.totalWithEvidence)} steder i ${chain.name} tar Amex.`;
  }

  public distance(metres: number | null): string | null {
    if (metres === null) {
      return null;
    }
    if (metres < 1000) {
      return `${String(Math.max(10, Math.round(metres / 10) * 10))} m`;
    }
    return `${(metres / 1000).toFixed(1).replace('.', ',')} km`;
  }

  public address(place: PlaceDto): string | null {
    if (place.kind === 'online') {
      return this.host(place.website);
    }
    const { street, postcode, city } = place.address;
    const area = [postcode, city].filter((part) => part !== null).join(' ');
    const parts = [street, area].filter((part): part is string => part !== null && part !== '');
    return parts.length === 0 ? null : parts.join(', ');
  }

  public category(category: PlaceCategory): string {
    return CATEGORIES[category];
  }

  public error(error: unknown): string {
    if (error instanceof ApiError) {
      return ERRORS[error.code] ?? 'Noe gikk galt. Prøv igjen.';
    }
    return 'Noe gikk galt. Prøv igjen.';
  }

  private userReports(accepted: number, rejected: number, date: string | null): string {
    const people = (count: number): string =>
      count === 1 ? 'Én bruker' : `${String(count)} brukere`;
    const sentence =
      accepted > 0 && rejected > 0
        ? `${people(accepted)} har fått betale med Amex her, ${people(rejected).toLowerCase()} er blitt avvist.`
        : accepted > 0
          ? `${people(accepted)} har fått betale med Amex her.`
          : `${people(rejected)} er blitt avvist her.`;
    return date === null ? sentence : `${sentence} Sist rapportert ${date}.`;
  }

  private on(date: string | null): string {
    return date === null ? '' : ` ${date}`;
  }

  /** `3. nov. 2026` in the phone's time zone. */
  private date(iso: string): string {
    const date = new Date(iso);
    return `${String(date.getDate())}. ${MONTHS[date.getMonth()] ?? ''} ${String(date.getFullYear())}`;
  }

  private host(website: string): string {
    try {
      return new URL(website).host.replace(/^www\./, '');
    } catch {
      return website;
    }
  }
}
