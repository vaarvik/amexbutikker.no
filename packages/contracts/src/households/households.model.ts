import { z } from 'zod';
import type { HouseholdId, UserId } from '../shared/shared.model.js';

// A household is a few phones that share Bonus spending (e.g. two people with one Amex account).
// The server only relays sealed records between them. It never has the key, so it cannot read an
// amount, a merchant or a goal. See docs/adr/0002-household-sync.md.

/** Phones per household. */
export const HOUSEHOLD_MAX_MEMBERS = 6;

/**
 * A sealed record as the phone sends it: base64url of nonce plus ciphertext. Opaque to the
 * server, which checks only its length.
 */
export const SEALED_RECORD_MAX_LENGTH = 8192;

export const SealedRecordSchema = z
  .string()
  .min(1)
  .max(SEALED_RECORD_MAX_LENGTH)
  .regex(/^[A-Za-z0-9_-]+$/);

/**
 * Proof that a phone has the household key, derived from it one way on the phone. The server
 * stores only its SHA-256 hash, so neither the token nor the hash gives the key back.
 */
export const JoinTokenSchema = z
  .string()
  .length(43)
  .regex(/^[A-Za-z0-9_-]+$/);

export interface Household {
  readonly id: HouseholdId;
  /** SHA-256 of the join token, hex. */
  readonly joinTokenHash: string;
  readonly createdAt: Date;
}

/** A phone (anonymous user) in a household. `leftAt` is set when it leaves. */
export interface HouseholdMembership {
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly joinedAt: Date;
  readonly leftAt: Date | null;
}

/** One sealed record, in the order the server received it. */
export interface HouseholdRecord {
  /** Increases within a household; the phones' cursor. */
  readonly seq: number;
  readonly householdId: HouseholdId;
  readonly authorId: UserId;
  readonly sealed: string;
  readonly createdAt: Date;
}

export interface NewHouseholdRecord {
  readonly householdId: HouseholdId;
  readonly authorId: UserId;
  readonly sealed: string;
  readonly createdAt: Date;
}
