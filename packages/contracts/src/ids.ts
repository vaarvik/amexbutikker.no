import { z } from 'zod';

declare const brand: unique symbol;

/**
 * A nominal type: `T` tagged with `B` so values of different ID kinds cannot be mixed.
 * The tag exists only at compile time; at runtime a branded ID is a plain `T`.
 */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

/** A place (physical store or online checkout). UUID. */
export type PlaceId = Brand<string, 'PlaceId'>;
/** A chain of physical places sharing a brand. UUID. */
export type ChainId = Brand<string, 'ChainId'>;
/** An anonymous user, one per registered device. UUID. */
export type UserId = Brand<string, 'UserId'>;
/** One piece of evidence. UUID. */
export type EvidenceId = Brand<string, 'EvidenceId'>;
/** One run of a source importer. UUID. */
export type ImportRunId = Brand<string, 'ImportRunId'>;

export const PlaceIdSchema: z.ZodType<PlaceId> = z.uuid().transform((value) => value as PlaceId);
export const ChainIdSchema: z.ZodType<ChainId> = z.uuid().transform((value) => value as ChainId);
export const UserIdSchema: z.ZodType<UserId> = z.uuid().transform((value) => value as UserId);
export const EvidenceIdSchema: z.ZodType<EvidenceId> = z
  .uuid()
  .transform((value) => value as EvidenceId);
export const ImportRunIdSchema: z.ZodType<ImportRunId> = z
  .uuid()
  .transform((value) => value as ImportRunId);
