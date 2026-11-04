import { z } from 'zod';

/** One underenhet (business unit at a location) from the Brønnøysund bulk file, as we use it. */
export interface BrregUnderenhet {
  readonly orgnr: string;
  readonly name: string;
  /** Main NACE code, e.g. `56.101`. */
  readonly naceCode: string;
  /** Street address at the location; the first line when there are several. */
  readonly street: string | null;
  readonly postcode: string | null;
  readonly kommunenummer: string | null;
  /** Set when the unit has closed. */
  readonly closedOn: string | null;
}

const optional = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value === '' ? null : value));

/** Parses a CSV row keyed by the bulk file's header names. */
export const BrregUnderenhetRowSchema: z.ZodType<BrregUnderenhet> = z
  .object({
    organisasjonsnummer: z.string().regex(/^\d{9}$/),
    navn: z.string().trim().min(1),
    'naeringskode1.kode': z.string(),
    'beliggenhetsadresse.adresse': optional,
    'beliggenhetsadresse.postnummer': optional,
    'beliggenhetsadresse.kommunenummer': optional,
    nedleggelsesdato: optional,
  })
  .transform((row) => ({
    orgnr: row.organisasjonsnummer,
    name: row.navn,
    naceCode: row['naeringskode1.kode'].trim(),
    street: row['beliggenhetsadresse.adresse']?.split(/\r?\n|, /)[0]?.trim() ?? null,
    postcode: row['beliggenhetsadresse.postnummer'],
    kommunenummer: row['beliggenhetsadresse.kommunenummer'],
    closedOn: row.nedleggelsesdato,
  }));

export const OSLO_KOMMUNENUMMER = '0301';

/** Retail (47), hotels (55.1) and food and beverage service (56). */
export const IMPORTED_NACE_PREFIXES = ['47.', '55.1', '56.'] as const;
