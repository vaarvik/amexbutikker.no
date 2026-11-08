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

## Set it up on the phone (by hand)

This works today without anything shared. It's also what the Apple Pay setup screen shows while
`EXPO_PUBLIC_WALLET_SHORTCUT_URL` is empty. The app opens that screen from a prompt on Steder
(shown until the user taps **Det er satt opp** or **Ikke nå**, or a payment link arrives) and from
Settings → Apple Pay.

1. Snarveier → **Automatisering** → **+** → **Transaksjon**.
2. Tick the Amex card, leave the other options as they are and choose **Kjør umiddelbart** (run
   immediately), then **Neste**.
3. **Ny tom automatisering**, then add these actions:
   - **URL-kod** (URL Encode) with **Snarvei-inndata → Forhandler**.
   - **URL-kod** with **Snarvei-inndata → Beløp**.
   - **Åpne URL-er** with
     `amexbutikker://paid?merchant=[URL-kodet tekst]&amount=[URL-kodet tekst 2]`, using the two
     encoded values.
4. Pay with the card. The app opens on "Betaling".

The app must be installed as a build with the `amexbutikker` scheme (a development build or
TestFlight). Expo Go uses its own scheme, so the link does not reach it there.

## Share it as one shortcut (owner, once)

An automation cannot be shared, but a shortcut can. Build a shortcut **Tar de Amex?** with the
three actions above, taking its input from the automation. Share it via iCloud and put the link in
`EXPO_PUBLIC_WALLET_SHORTCUT_URL` for the build. The setup screen then shows **Legg til
snarveien** instead of the steps. Users still create the automation themselves (trigger plus "Kjør snarvei: Tar de
Amex?"), since iOS asks the user for that.

Before sharing, check on a phone:

- that the shortcut gets the merchant and the amount when the automation passes on its input;
- what the trigger does on a declined payment (does it fire, and with which amount);
- how the amount looks in Norwegian and English iOS (`kr 1 299,50`, `NOK 1,299.50`).
  `ShortcutWalletLinkParser` reads both.

## Try it without paying

- In a development build: Settings → **Send testbetaling** (only in `__DEV__`).
- From the Mac, with the simulator running:
  `xcrun simctl openurl booted 'amexbutikker://paid?merchant=Kaf%C3%A9%20%C3%85sen&amount=kr%2049%2C00'`
