# ADR 0002: Household sync for Bonus

Status: accepted, 2026-11-08

## Context

Bonus tracks spending towards a card's goals (e.g. 150 000 kr a year for a companion ticket). Two
people often share one Amex account, each with a card on their own iPhone. Each phone only sees its
own payments, so each phone's progress is too low. The rule so far was that amounts never leave the
phone. The card issuer's app does not show the yearly total, so typing it in is not a fix.

## Decision

Phones form a **household** and share every spending change, end-to-end encrypted. The server only
relays sealed records it cannot read.

- **Changes, not documents.** Every Bonus change is a `SpendingChange` (`entry_added`,
  `entry_removed`, `card_set`, `milestone_added`, `milestone_removed`).
  `ReplayingSpendingStateCalculator` replays them by item id: applying one twice does nothing, and
  removals are remembered (`removedIds`) so they stay final in any order.
- **Key.** One random 32-byte key per household, made on the phone that creates it. It travels only
  in the invite link `amexbutikker://household/join?invite=<id>.<key>`, shown as a QR code (scanned
  with the Camera app) or shared from the share sheet. It is kept in the keychain.
- **Crypto.** Each record is XChaCha20-Poly1305 with a random 24-byte nonce (`@noble/ciphers`).
  The join token is HKDF-SHA256 of the key with its own label; the server stores its SHA-256 hash
  and checks it on join. Neither gives the key back.
- **Sync.** Local changes are queued and sent in batches of 50; the phone then reads records after
  its cursor, skips its own and replays the rest. It runs on app start and foreground, after a local
  change and when Bonus opens. Offline, changes wait.
- **Joining.** The joining phone shares its purchases and own goals; the household's card and its
  goals replace the phone's own.
- **Leaving.** The server stops serving records to a phone that left; the phone keeps its copy. The
  key is not rotated: a phone that left has no access to new records anyway.

## What the server sees

Household and membership ids, the number, size and timing of records and which device sent them.
Not amounts, merchants, places, cards or goals.

## Alternatives

1. **Type the total from the issuer's app.** No sync needed, but the app does not show it.
2. **Statement import** (Phase 14d). Accurate and on the phone, but monthly and manual.
3. **Plain sync on the server.** Simpler, but the server would hold every amount.

## Consequences

The rule "amounts never reach the API" becomes "amounts reach the API only sealed, with a key the
API never has". Records are append-only and kept; a purge of empty households can come later.
