import { z } from 'zod';
import { AcceptanceResultSchema } from '../evidence/evidence.model.js';
import type { AcceptanceResult } from '../evidence/evidence.model.js';
import { ReportChannelSchema } from './reports.model.js';
import type { ReportChannel } from './reports.model.js';
import { ChainHintDtoSchema, PlaceStatusDtoSchema } from '../status/status.dtos.js';
import type { ChainHintDto, PlaceStatusDto } from '../status/status.dtos.js';

// ---------------------------------------------------------------------------
// POST /v1/places/:id/reports  (device token required)  ->  StatusChangeResponseDto
// DELETE /v1/places/:id/reports/me  (device token required)  ->  StatusChangeResponseDto

export interface SubmitReportRequestDto {
  readonly result: AcceptanceResult;
  readonly note?: string;
  /** Defaults to `app`. */
  readonly via?: ReportChannel;
}

export const SubmitReportRequestDtoSchema: z.ZodType<SubmitReportRequestDto> = z.object({
  result: AcceptanceResultSchema,
  note: z.string().trim().min(1).max(500).exactOptional(),
  via: ReportChannelSchema.exactOptional(),
});

export interface StatusChangeResponseDto {
  readonly status: PlaceStatusDto;
  readonly chainHint: ChainHintDto | null;
}

export const StatusChangeResponseDtoSchema: z.ZodType<StatusChangeResponseDto> = z.object({
  status: PlaceStatusDtoSchema,
  chainHint: ChainHintDtoSchema.nullable(),
});
