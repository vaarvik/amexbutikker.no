import { z } from 'zod';
import { EvidenceKindSchema } from '../evidence/evidence.model.js';
import type { EvidenceKind } from '../evidence/evidence.model.js';
import { ChainIdSchema, PlaceIdSchema } from '../shared/shared.model.js';
import type { ChainId, PlaceId } from '../shared/shared.model.js';

/**
 * The answer shown to users. `accepted` / `rejected` need confirmation from users' own answers;
 * with less (only lists and chain claims, or a single user) the answer is `likely_*`.
 */
export type AcceptanceStatus =
  'accepted' | 'likely_accepted' | 'rejected' | 'likely_rejected' | 'mixed' | 'unknown';
export const ACCEPTANCE_STATUSES = [
  'accepted',
  'likely_accepted',
  'rejected',
  'likely_rejected',
  'mixed',
  'unknown',
] as const satisfies readonly AcceptanceStatus[];
export const AcceptanceStatusSchema: z.ZodType<AcceptanceStatus> = z.enum(ACCEPTANCE_STATUSES);

/**
 * Computed acceptance status of one place. Never written by hand: always the output of an
 * AcceptanceStatusCalculator.
 *
 * Invariants:
 * - `status === 'unknown'` implies `confidence === 0`, `basis === null`.
 * - `basis` is the strongest evidence kind that contributed weight.
 * - `verified` is true when any contributing evidence is `transaction` or `visit_report`.
 * - `lastEvidenceAt` is the newest `observedAt` among contributing evidence.
 */
export interface PlaceStatus {
  readonly status: AcceptanceStatus;
  /** 0..1. Share of decayed weight on the winning side, scaled down when total weight is low. */
  readonly confidence: number;
  readonly basis: EvidenceKind | null;
  readonly verified: boolean;
  readonly lastEvidenceAt: Date | null;
}

export const PlaceStatusSchema: z.ZodType<PlaceStatus> = z.object({
  status: AcceptanceStatusSchema,
  confidence: z.number().min(0).max(1),
  basis: EvidenceKindSchema.nullable(),
  verified: z.boolean(),
  lastEvidenceAt: z.date().nullable(),
});

/** The status of an unseen place, before any evidence exists. */
export const UNKNOWN_PLACE_STATUS: PlaceStatus = Object.freeze({
  status: 'unknown',
  confidence: 0,
  basis: null,
  verified: false,
  lastEvidenceAt: null,
});

/** A place status as stored, with what and when it was calculated for. */
export interface PlaceStatusSnapshot {
  readonly placeId: PlaceId;
  readonly status: PlaceStatus;
  readonly calculatedAt: Date;
}

export const PlaceStatusSnapshotSchema: z.ZodType<PlaceStatusSnapshot> = z.object({
  placeId: PlaceIdSchema,
  status: PlaceStatusSchema,
  calculatedAt: z.date(),
});

/**
 * "7 of 9 stores in this chain accept". Shown next to a place's status, never used as the status.
 *
 * Invariant: `0 <= acceptedCount <= totalWithEvidence`.
 */
export interface ChainHint {
  readonly chainId: ChainId;
  /** Places in the chain whose direct evidence says `accepted`. */
  readonly acceptedCount: number;
  /** Places in the chain that have any direct evidence. */
  readonly totalWithEvidence: number;
  readonly calculatedAt: Date;
}

export const ChainHintSchema: z.ZodType<ChainHint> = z
  .object({
    chainId: ChainIdSchema,
    acceptedCount: z.int().nonnegative(),
    totalWithEvidence: z.int().nonnegative(),
    calculatedAt: z.date(),
  })
  .refine((hint) => hint.acceptedCount <= hint.totalWithEvidence, {
    message: 'acceptedCount cannot exceed totalWithEvidence',
    path: ['acceptedCount'],
  });
