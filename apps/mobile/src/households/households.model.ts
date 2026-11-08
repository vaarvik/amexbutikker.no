import type { HouseholdId } from '@amexbutikker/contracts';
import { HouseholdIdSchema } from '@amexbutikker/contracts';
import { z } from 'zod';
import { SpendingChangeSchema } from '../spending/spending.model';
import type { SpendingChange } from '../spending/spending.model';

/**
 * What another phone needs to join: the household id and its key, as the link
 * `amexbutikker://household/join?invite=<id>.<key>` in a QR code (scanned with the Camera app) or
 * shared from the share sheet. A custom-scheme link is opened by the app and never fetched, so the
 * key only travels between the phones.
 */
export interface HouseholdInvite {
  readonly householdId: HouseholdId;
  /** 32 random bytes, base64url. */
  readonly key: string;
}

export const HouseholdInviteSchema: z.ZodType<HouseholdInvite> = z.object({
  householdId: HouseholdIdSchema,
  key: z
    .string()
    .length(43)
    .regex(/^[A-Za-z0-9_-]+$/),
});

/** The household this phone is in, as stored on the phone (in the keychain: it holds the key). */
export interface StoredHousehold {
  readonly invite: HouseholdInvite;
  /** The last record `seq` read from the server. */
  readonly cursor: number;
  /** Changes made here and not yet sent, oldest first. */
  readonly pending: readonly SpendingChange[];
  /** As of the last sync, for Settings while offline. */
  readonly memberCount: number;
  /** ISO time of the last sync that went both ways; null before the first. */
  readonly syncedAt: string | null;
}

/** What is kept outside the keychain: everything but the invite. */
export const HouseholdProgressSchema = z.object({
  cursor: z.int().min(0),
  pending: z.array(SpendingChangeSchema),
  memberCount: z.int().min(1),
  syncedAt: z.iso.datetime().nullable(),
});

/** What Settings shows about sharing. */
export type HouseholdStatus =
  | { readonly kind: 'alone' }
  | {
      readonly kind: 'member';
      readonly memberCount: number;
      /** For the QR code. */
      readonly inviteLink: string;
      /** When changes last went both ways; null before the first sync. */
      readonly syncedAt: Date | null;
    };

/** How a sync went. Offline is not an error: pending changes wait for the next one. */
export type HouseholdSyncResult =
  | { readonly kind: 'synced'; readonly sent: number; readonly received: number }
  | { readonly kind: 'alone' }
  | { readonly kind: 'offline' }
  /** Removed from the household elsewhere (it left on this phone's behalf, or was reset). */
  | { readonly kind: 'gone' };
