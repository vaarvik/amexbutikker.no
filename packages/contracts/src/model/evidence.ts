import { z } from 'zod';
import { ChainIdSchema, EvidenceIdSchema, PlaceIdSchema, UserIdSchema } from '../ids.js';
import type { ChainId, EvidenceId, PlaceId, UserId } from '../ids.js';

/** Kinds of evidence, strongest first. */
export type EvidenceKind =
  | 'transaction'
  | 'visit_report'
  | 'user_report'
  | 'chain_confirmation'
  | 'external_list'
  | 'checkout_logo';
/** All evidence kinds, ordered strongest first. */
export const EVIDENCE_KINDS = [
  'transaction',
  'visit_report',
  'user_report',
  'chain_confirmation',
  'external_list',
  'checkout_logo',
] as const satisfies readonly EvidenceKind[];
export const EvidenceKindSchema: z.ZodType<EvidenceKind> = z.enum(EVIDENCE_KINDS);

/** Evidence kinds that come from someone actually paying (or trying to) at this place. */
export type DirectEvidenceKind = Extract<
  EvidenceKind,
  'transaction' | 'visit_report' | 'user_report'
>;
export const DIRECT_EVIDENCE_KINDS = [
  'transaction',
  'visit_report',
  'user_report',
] as const satisfies readonly DirectEvidenceKind[];

/** Whether the card was accepted. */
export type AcceptanceResult = 'accepted' | 'rejected';
export const ACCEPTANCE_RESULTS = [
  'accepted',
  'rejected',
] as const satisfies readonly AcceptanceResult[];
export const AcceptanceResultSchema: z.ZodType<AcceptanceResult> = z.enum(ACCEPTANCE_RESULTS);

/**
 * The result field of stored evidence. `withdrawn` is appended by a user who removes their
 * report: it supersedes that user's earlier evidence for the place and contributes no weight.
 */
export type EvidenceResult = AcceptanceResult | 'withdrawn';
export const EVIDENCE_RESULTS = [
  'accepted',
  'rejected',
  'withdrawn',
] as const satisfies readonly EvidenceResult[];
export const EvidenceResultSchema: z.ZodType<EvidenceResult> = z.enum(EVIDENCE_RESULTS);

/** What the evidence is about: one place, or a whole chain. */
export type EvidenceTarget =
  | { readonly type: 'place'; readonly placeId: PlaceId }
  | { readonly type: 'chain'; readonly chainId: ChainId };

export const EvidenceTargetSchema: z.ZodType<EvidenceTarget> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('place'), placeId: PlaceIdSchema }),
  z.object({ type: z.literal('chain'), chainId: ChainIdSchema }),
]);

/**
 * One observation that a place or chain accepts or rejects the card.
 *
 * Invariants:
 * - Append-only. Never updated or deleted; newer evidence supersedes older.
 * - `(source, sourceRef)` is unique, which makes imports idempotent.
 * - `userId` is set for user-originated kinds (`transaction`, `visit_report`, `user_report`)
 *   and null for imported kinds.
 * - `result: 'withdrawn'` only occurs with a `userId`.
 * - `observedAt` is when the fact held. For imported claims it is the claim's `fetchedAt`,
 *   so decay counts from when the source was read.
 */
export interface Evidence {
  readonly id: EvidenceId;
  readonly target: EvidenceTarget;
  readonly kind: EvidenceKind;
  readonly result: EvidenceResult;
  /** Where it came from, e.g. `app`, `osm`, `kredittkort360`, `amex_statement`. */
  readonly source: string;
  /** Identifier within the source, unique per source. */
  readonly sourceRef: string;
  readonly observedAt: Date;
  readonly importedAt: Date;
  readonly userId: UserId | null;
  /** Free-text note from the user or the curated claim. At most 500 characters. */
  readonly note: string | null;
}

export const EvidenceSchema: z.ZodType<Evidence> = z.object({
  id: EvidenceIdSchema,
  target: EvidenceTargetSchema,
  kind: EvidenceKindSchema,
  result: EvidenceResultSchema,
  source: z.string().trim().min(1).max(100),
  sourceRef: z.string().trim().min(1).max(500),
  observedAt: z.date(),
  importedAt: z.date(),
  userId: UserIdSchema.nullable(),
  note: z.string().max(500).nullable(),
});
