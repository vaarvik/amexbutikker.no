import type { LocalDate } from './spending.model';
import type { SpendingPresenter } from './spending.ports';

const MONTHS = [
  'jan.',
  'feb.',
  'mars',
  'apr.',
  'mai',
  'juni',
  'juli',
  'aug.',
  'sep.',
  'okt.',
  'nov.',
  'des.',
];

/** Kroner and dates the Norwegian way. No Intl: Hermes ships it only partly. */
export class NorwegianSpendingPresenter implements SpendingPresenter {
  public amount(nok: number): string {
    // A narrow no-break space between thousands, like "150 000 kr".
    const digits = String(Math.round(Math.abs(nok))).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
    return `${nok < 0 ? '−' : ''}${digits} kr`;
  }

  public date(date: LocalDate): string {
    const [year, month, day] = date.split('-').map(Number);
    return `${String(day)}. ${MONTHS[(month ?? 1) - 1] ?? ''} ${String(year)}`;
  }

  public parseAmount(text: string): number | null {
    const cleaned = text
      .replace(/kr\.?|nok/gi, '')
      .replace(/[\s.]/g, '') // \s covers no-break spaces too
      .replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
      return null;
    }
    const amount = Math.round(Number(cleaned));
    return amount > 0 ? amount : null;
  }

  public parseDate(text: string): LocalDate | null {
    const trimmed = text.trim();
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
    const norwegian = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(trimmed);
    const [year, month, day] = iso
      ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
      : norwegian
        ? [
            Number(norwegian[3]) + (norwegian[3]?.length === 2 ? 2000 : 0),
            Number(norwegian[2]),
            Number(norwegian[1]),
          ]
        : [0, 0, 0];
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      year < 2000 ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date.toISOString().slice(0, 10);
  }

  public dateInput(date: LocalDate): string {
    const [year, month, day] = date.split('-');
    return `${day ?? ''}.${month ?? ''}.${year ?? ''}`;
  }
}
