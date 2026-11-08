import { z } from 'zod';

/**
 * How the user gave the answer.
 * - `app`: tapped "Det funket" / "Ble avvist" in the app (a `user_report`).
 * - `wallet`: an Apple Wallet payment with the card handed the place to the app through the
 *   Shortcuts "Transaction" automation (a `visit_report`, source `wallet`). The tap may also fire
 *   on a declined payment, so it counts like a visit, not like a statement transaction.
 */
export type ReportChannel = 'app' | 'wallet';
export const REPORT_CHANNELS = ['app', 'wallet'] as const satisfies readonly ReportChannel[];
export const ReportChannelSchema: z.ZodType<ReportChannel> = z.enum(REPORT_CHANNELS);
