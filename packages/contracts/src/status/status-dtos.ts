import { z } from 'zod';
import { EvidenceKindSchema } from '../evidence/evidence.js';
import type { EvidenceKind } from '../evidence/evidence.js';
import { IsoDateTimeSchema } from '../shared/http-dtos.js';
import type { IsoDateTime } from '../shared/http-dtos.js';
import { ChainIdSchema } from '../shared/ids.js';
import type { ChainId } from '../shared/ids.js';
import { AcceptanceStatusSchema } from './place-status.js';
import type { AcceptanceStatus } from './place-status.js';

export interface PlaceStatusDto {
  readonly status: AcceptanceStatus;
  readonly confidence: number;
  readonly basis: EvidenceKind | null;
  readonly verified: boolean;
  readonly lastEvidenceAt: IsoDateTime | null;
}

export const PlaceStatusDtoSchema: z.ZodType<PlaceStatusDto> = z.object({
  status: AcceptanceStatusSchema,
  confidence: z.number().min(0).max(1),
  basis: EvidenceKindSchema.nullable(),
  verified: z.boolean(),
  lastEvidenceAt: IsoDateTimeSchema.nullable(),
});

export interface ChainHintDto {
  readonly chainId: ChainId;
  readonly acceptedCount: number;
  readonly totalWithEvidence: number;
}

export const ChainHintDtoSchema: z.ZodType<ChainHintDto> = z.object({
  chainId: ChainIdSchema,
  acceptedCount: z.int().nonnegative(),
  totalWithEvidence: z.int().nonnegative(),
});
