import { z } from 'zod';
import { ChainIdSchema } from '../shared/shared.model.js';
import type { ChainId } from '../shared/shared.model.js';

/** A brand with several physical places, e.g. a supermarket chain. */
export interface Chain {
  readonly id: ChainId;
  /** Display name, e.g. "Rema 1000". */
  readonly name: string;
  /** Wikidata Q-id from OSM `brand:wikidata`, the preferred identity for matching. */
  readonly brandWikidata: string | null;
  readonly createdAt: Date;
}

export const ChainSchema: z.ZodType<Chain> = z.object({
  id: ChainIdSchema,
  name: z.string().trim().min(1).max(200),
  brandWikidata: z
    .string()
    .regex(/^Q\d+$/)
    .nullable(),
  createdAt: z.date(),
});
