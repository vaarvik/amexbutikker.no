# Answers from Apple Pay (Shortcuts)

iOS 17 and later can run a Shortcuts automation when a card in Apple Wallet is used: the
**Transaction** trigger (Norwegian iOS: **Transaksjon**). It gives the shortcut the merchant
(**Forhandler**), the amount (**Beløp**) and the card. The automation opens

```
amexbutikker://paid?merchant=<merchant, URL-encoded>&amount=<amount, URL-encoded>
```

and the app does the rest (`apps/mobile/src/app/paid.tsx`, `apps/mobile/src/payments/`):

1. **Amount → Bonus.** With an amount in kroner, a `wallet` purchase is saved on the phone. The
   amount is never sent anywhere. Amounts in another currency are left out.
2. **Merchant → place.** The merchant name and the phone's position go to
   `POST /v1/match/payment`. The API strips processor prefixes and company forms
   (`RegexMerchantNameParser`) and matches like a shared place (`TrigramGeoPlaceMatcher`). The
   request body is strict: an `amount` field is refused.
3. **One clear place** (score at least 0.7, at least 0.2 ahead of the next one): "Tar Amex" is saved
   right away (`via: 'wallet'`). The screen offers **Kortet ble avvist**, **Angre** and **Feil sted?**.
   **Several places**: the user picks one. **None**: the user can add the place, with the name
   filled in.
4. **The same payment twice** (same merchant and amount within 10 minutes) is ignored.

A wallet answer is stored as a `visit_report` with source `wallet` (weight 0.8, below
`confirmedWeight` 1.0). One payment therefore gives **Trolig ja** with `verified`, and a second
answer from anyone gives **Ja**. The trigger fires on the tap, and it may also fire on a declined
payment, so a wallet answer counts like a visit, not like a statement transaction. A declined
payment's purchase is removed from Bonus when the user taps **Kortet ble avvist**.

## Set it up on the phone

The app ships its own Shortcuts action, **Registrer Amex-betaling** (an App Intent:
`apps/mobile/plugins/payment-intent/RecordAmexPaymentIntent.swift`, added to the app target by
`plugins/with-payment-intent.js` on prebuild). It takes **Forhandler** and **Beløp** and opens the
link above, so no one types a URL. iOS lets only the user create an automation, so that part stays
by hand. The setup screen (from the prompt on Steder, shown until **Det er satt opp** or a payment
link arrives, and from Settings → Apple Pay) lists the steps:

1. Snarveier → **Automatisering** → **+** → **Transaksjon**.
2. Tick the Amex card, choose **Kjør umiddelbart**, then **Neste**.
3. Search for **Registrer Amex-betaling** and pick it. Tap **Forhandler** and choose the trigger's
   Forhandler, then **Beløp** and choose Beløp.

The action needs a build made after it was added (a new development build or TestFlight). Expo Go
has neither the action nor the `amexbutikker` scheme.

Check on a phone:

- what the trigger does on a declined payment (does it fire, and with which amount);
- how the amount arrives as text in Norwegian and English iOS (`kr 1 299,50`, `NOK 1,299.50`).
  `ShortcutWalletLinkParser` reads both.

### Other cards (optional)

A second action, **Registrer annen betaling** (`RecordOtherPaymentIntent.swift`), is for a
second Transaction automation with the user's other cards ticked. It takes only **Forhandler**
and opens `amexbutikker://paid?merchant=…&card=other`. Paying with another card says nothing
about Amex, so the app saves nothing on its own: for one clear place it asks **Tok de ikke Amex?**
(**Tok ikke Amex**, a rejected wallet report, or **Vet ikke**, nothing). It stays quiet, closing after a moment,
when no place is clear, the place already has Ja or Nei, or it asked about that place in the
last 30 days (`asked-places-v1` on the phone). No amount goes to Bonus.

Each iPhone needs its own automation: the Transaction trigger fires only for payments made with
the Wallet on that phone. Two people sharing an Amex account (a supplementary card) each set it
up on their own phone. Once set up, the setup screen shows how to delete it again.

## Try it without paying

- In a development build: Settings → **Send testbetaling** (only in `__DEV__`).
- From the Mac, with the simulator running:
  `xcrun simctl openurl booted 'amexbutikker://paid?merchant=Kaf%C3%A9%20%C3%85sen&amount=kr%2049%2C00'`
- Another card: the same link with `&card=other`.
