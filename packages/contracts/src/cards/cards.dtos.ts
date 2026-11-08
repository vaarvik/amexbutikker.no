import { z } from 'zod';
import { CardSchema } from './cards.model.js';
import type { Card } from './cards.model.js';

// ---------------------------------------------------------------------------
// GET /v1/cards  ->  CardListResponseDto

export type CardDto = Card;

export interface CardListResponseDto {
  readonly cards: readonly CardDto[];
}

export const CardListResponseDtoSchema: z.ZodType<CardListResponseDto> = z.object({
  cards: z.array(CardSchema),
});
