import { z } from 'zod';

// Wire format: JSON. Dates are ISO 8601 strings with offset. IDs are UUID strings.

/** ISO 8601 date-time with offset, e.g. `2026-11-03T20:40:00Z`. */
export type IsoDateTime = string;
export const IsoDateTimeSchema: z.ZodType<IsoDateTime> = z.iso.datetime({ offset: true });

/** Body of every non-2xx response. */
export interface ErrorResponseDto {
  readonly error: {
    /** DomainError.code, e.g. `not_found`, `validation_failed`, `rate_limited`, or `internal`. */
    readonly code: string;
    readonly message: string;
    readonly issues?: readonly {
      readonly path: readonly (string | number)[];
      readonly message: string;
    }[];
    readonly retryAfterSeconds?: number;
    /** With `duplicate_place`: the place the new one looks like. */
    readonly existingPlaceId?: string;
  };
}

export const ErrorResponseDtoSchema: z.ZodType<ErrorResponseDto> = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    issues: z
      .array(z.object({ path: z.array(z.union([z.string(), z.number()])), message: z.string() }))
      .exactOptional(),
    retryAfterSeconds: z.number().nonnegative().exactOptional(),
    existingPlaceId: z.string().exactOptional(),
  }),
});
