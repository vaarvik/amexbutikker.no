import { AcceptanceResultSchema } from '@amexbutikker/contracts';
import type { AcceptanceResult } from '@amexbutikker/contracts';
import { z } from 'zod';

/** One claim in data/curated-claims.yaml: a list or site says a chain or place accepts the card. */
export interface CuratedClaim {
  readonly target: 'chain' | 'place';
  /** Matched like ChainReader.findByName: exact after trimming, case and accents. */
  readonly name: string;
  readonly result: AcceptanceResult;
  /** Short source id, e.g. `kredittkort360`. Stored as the evidence source. */
  readonly source: string;
  readonly sourceUrl: string;
  /** When the source said so. Becomes the evidence's observedAt, so decay counts from here. */
  readonly fetchedAt: Date;
  readonly note: string | null;
}

export const CuratedClaimSchema: z.ZodType<CuratedClaim> = z
  .object({
    target: z.enum(['chain', 'place']),
    name: z.string().trim().min(1).max(200),
    result: AcceptanceResultSchema,
    source: z
      .string()
      .trim()
      .regex(/^[a-z0-9_.-]{1,100}$/),
    sourceUrl: z.url({ protocol: /^https?$/ }),
    fetchedAt: z.union([z.iso.date(), z.iso.datetime({ offset: true })]),
    note: z.string().trim().max(500).nullish(),
  })
  .strict()
  .transform((claim) => ({
    ...claim,
    fetchedAt: new Date(claim.fetchedAt),
    note: claim.note ?? null,
  }));

/** The file: `claims:` holds the list. Claims are validated one by one. */
export interface CuratedClaimFile {
  readonly claims: readonly unknown[] | null;
}

export const CuratedClaimFileSchema: z.ZodType<CuratedClaimFile> = z.object({
  claims: z.array(z.unknown()).nullable(),
});
