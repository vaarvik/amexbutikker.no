# Prompts for Claude Code

Put CLAUDE.md in the repo root first. Run one phase per session. Do not start a phase before the previous one is green.

---

## Phase 0: Scaffold and enforcement

```
Read CLAUDE.md. Set up the monorepo exactly as described there.

- pnpm workspaces: packages/contracts, packages/domain, packages/application, apps/api, apps/mobile (blank Expo app with expo-router on the current Expo SDK), tools/contract-check.
- tsconfig.base.json with the compiler options from CLAUDE.md, project references between packages.
- ESLint with typescript-eslint strict-type-checked, plus: no default exports, explicit-member-accessibility, no-explicit-any, consistent-type-imports. Prettier.
- Vitest workspace config.
- docker-compose.yml with postgis/postgis:16 and an init script enabling postgis, pg_trgm and unaccent.
- tools/contract-check (ts-morph) must fail when:
  a) an exported class in packages/application or apps/api/src (excluding composition-root.ts and tests) does not implement at least one interface,
  b) packages/domain or packages/application import from apps/*, fastify, kysely, pg, expo, react-native,
  c) `new` is used on a class from packages/application or apps/api/src/infrastructure outside composition-root.ts and tests,
  d) a file under packages/contracts/src (outside test-kit) contains a class other than an Error subclass.
  Include tests for the checker itself with small fixture files that should pass and fail.
- Root scripts: typecheck, lint, test, contract-check, db:up, db:migrate.
- GitHub Actions workflow running typecheck, lint, test and contract-check.
- Fill in the Commands section of CLAUDE.md.

Propose the plan first and wait for my go.
```

---

## Phase 1: Contracts only (stop for review)

```
Interfaces only. Do not implement anything in this phase.

In packages/contracts define:

Branded IDs: PlaceId, ChainId, UserId, EvidenceId, ImportRunId.

Data interfaces, each with a zod schema typed as z.ZodType<T>:
Place (discriminated union physical | online), Chain, Evidence, EvidenceKind, AcceptanceResult,
PlaceStatus (status, confidence 0..1, basis, verified, lastEvidenceAt),
ChainHint (acceptedCount, totalWithEvidence), GeoPoint, PlaceSearchQuery, NearbyQuery,
PlaceCandidate (place, score, reasons), ParsedSharedPlace, ImportRunReport.

Ports:
- PlaceReader (getById, search, nearby), PlaceWriter (create, upsertFromSource)
- ChainReader, ChainWriter
- EvidenceReader (listForPlace, listForChain), EvidenceWriter (append)
- PlaceStatusReader, PlaceStatusWriter
- UnitOfWork (run a callback with transactional instances of the writer ports)
- EvidenceWeightPolicy (weightFor, halfLifeDays)
- AcceptanceStatusCalculator (calculate(placeEvidence, chainEvidence, now): PlaceStatus)
- ChainHintCalculator
- SharedTextParser (parse(text): ParsedSharedPlace)
- SharedLinkResolver
- PlaceMatcher (match(parsed): Promise<PlaceCandidate[]>)
- SourceImporter (readonly source, run(context): Promise<ImportRunReport>)
- Clock, IdGenerator, Logger, DeviceTokenService (issue, verify)

Use case interfaces, each with one execute method:
SearchPlaces, ListNearbyPlaces, GetPlaceDetails, CreatePlace, SubmitReport, RemoveMyReport,
MatchSharedPlace, RegisterDevice, RunImport.

API request/response DTOs for every endpoint listed in phase 4, with zod schemas.

Typed errors: DomainError, NotFoundError, ValidationError, ConflictError, RateLimitedError.

Document every method with TSDoc: inputs, outputs, which typed errors it throws, and invariants.
Add contract test kits in packages/contracts/test-kit for every repository port: describeXContract(factory). The tests are written now, against the interface only.

When done, stop and list every interface with a one-line responsibility so I can review.
```

---

## Phase 2: Domain logic (test first)

```
Implement in packages/domain against the approved contracts. Write the Vitest tests before the implementation.

- FixedEvidenceWeightPolicy: weights and half-lives come from a config object passed to the constructor. Defaults (weight / half-life in days):
  transaction 1.0/365, visit_report 0.8/180, user_report 0.6/180, chain_confirmation 0.5/365,
  external_list 0.25/180 (decay counted from fetchedAt), checkout_logo 0.1/90.
- DecayingAcceptanceStatusCalculator:
  - exponential decay by half-life
  - only the latest evidence per (userId, placeId)
  - direct evidence on the place (transaction, visit_report, user_report) overrides chain_confirmation and external_list
  - accepted or rejected when one side has at least 80 % of the decayed weight, mixed otherwise
  - unknown when total decayed weight is below a configurable threshold
  - basis = strongest evidence kind that contributed; verified = any transaction or visit_report
- ProportionChainHintCalculator: among the chain's places with direct evidence, how many are accepted.

Required test cases at minimum: only an external claim; one fresh rejection against an old external claim;
a user changing their report; chain confirmed but this store rejects; all evidence older than four half-lives;
an online place with mixed reports.
```

---

## Phase 3: Persistence

```
Using the feature folders from CLAUDE.md (Pg adapters in `apps/api/src/<feature>/`, in-memory adapters in `packages/in-memory/src/<feature>/`, migrations in `apps/api/src/migrations/`):

- Kysely migrations (with down migrations) for: chains, places, evidence, place_status, import_runs, devices.
  - places: kind, chain_id null, name, category, street, postcode, city, geom geography(Point,4326) null for online,
    website, osm_ref unique null, brreg_orgnr null, created_at.
  - evidence: append-only, CHECK (place_id IS NOT NULL OR chain_id IS NOT NULL),
    index on (place_id, observed_at desc), index supporting latest-per-(user_id, place_id) lookups.
  - Revoke UPDATE and DELETE on evidence for the application role.
- Indexes: GIST on geom; GIN trigram on an IMMUTABLE wrapper around unaccent(lower(name)) so it can be indexed.
- Pg* implementations of every repository port and of UnitOfWork. Row-to-domain mapping validated with zod.
- InMemory* implementations of the same ports.
- Run the phase 1 contract test kits against both: in-memory in unit tests, Postgres through Testcontainers.
```

---

## Phase 4: Use cases and API

```
- Implement every use case from phase 1 as a class in packages/application.
  SubmitReport and RemoveMyReport append evidence, then recalculate the place status and the chain hint inside one UnitOfWork.
- Fastify adapter in apps/api/src/http: one controller class per resource implementing an HttpController interface (register(app)).
  zod validation on every request and response. One ErrorMapper class maps typed errors to HTTP status codes.
- Endpoints:
  GET    /v1/places/search?q&lat&lng&kind
  GET    /v1/places/nearby?lat&lng&radiusM
  GET    /v1/places/:id                    (status, basis sentence data, chain hint, latest notes)
  POST   /v1/places
  POST   /v1/places/:id/reports            { result, note? }
  DELETE /v1/places/:id/reports/me
  POST   /v1/match/shared                  { text }
  POST   /v1/devices
- Anonymous device auth: POST /v1/devices issues a signed token, write endpoints require it. One active report per device per place.
- Rate limiting on report and create endpoints.
- composition-root.ts wires everything; server.ts only starts it.
- Performance target: search and nearby p95 under 100 ms locally with 50,000 places.
  Add a script that generates synthetic places, and show me EXPLAIN ANALYZE for both queries.
```

---

## Phase 5: Seed data

```
SourceImporter implementations in apps/api/src/imports/importers/<source>/, run with `pnpm import <source>`.
Every importer is idempotent on sourceRef, writes an import_runs row with counts, and never deletes evidence.

1. OverpassOsmImporter: Oslo municipality first.
   amenity=restaurant|cafe|bar|pub|fast_food, shop=*, tourism=hotel.
   Map name, brand + brand:wikidata (to Chain), addr:*, coordinates, osm type+id as osm_ref.
   One query, response cached to disk, configurable endpoint, respect the Overpass usage policy.
2. CuratedListImporter: reads data/curated-claims.yaml, validated with zod:
   { target: chain | place, name, result, source, sourceUrl, fetchedAt, note? }.
   Creates chain_confirmation or external_list evidence. I will paste the claims; do not fetch any of those sites.
3. BrregUnderenhetImporter: bulk file from data.brreg.no, filter NACE 47.*, 55.1*, 56.*, Oslo only.
   Attach brreg_orgnr to existing OSM places by normalised address match. Do not create places from Brreg alone yet.
   Log the match rate.
4. StatementImporter: interface wiring and skeleton only. The file format goes behind a StatementParser interface;
   I will provide an anonymised Amex export later. Unmatched merchant descriptors go to a review table and never create evidence automatically.
```

---

## Phase 5b: Naming audit

```
Audit every file and folder in packages/*, apps/api and tools/* against the naming standards in CLAUDE.md
(File naming, Code names, Method verbs, folder layout). Start with apps/api/src/imports/importers/.
1. List every deviation with path, rule and proposed name. Decide open questions once, for example:
   importer folder = source id (`osm` vs `osm_overpass`), the prefix of importer-local ports/model files,
   whether a file name may start with the mechanism (`default-…`, `http-…`) or must start with the domain noun.
2. Write each decision into CLAUDE.md.
3. Extend tools/contract-check so each decided rule fails the build, with pass/fail fixtures.
4. Rename in one commit per rule; all checks green after each.
```

---

## Phase 6: Mobile app

```
In apps/mobile (Expo, expo-router, TypeScript):

- Non-UI services as classes behind interfaces: PlacesApiClient (fetch, zod-validated responses),
  DeviceSession (token in expo-secure-store), LocationProvider (expo-location, foreground only),
  NearbyCache. The composition root builds them; a ServicesProvider context exposes them through a typed hook.
- Screens:
  - Home: search field focused on launch, plus a "nær deg" list sorted by distance.
  - Place: one big answer (Ja / Nei / Varierer / Ikke sjekket), a sentence explaining the basis
    (e.g. "Ifølge kredittkort360, ikke bekreftet av brukere"), the chain hint, and buttons "Det funket" / "Ble avvist".
  - Add place.
- Norwegian bokmål UI copy. Status colours pass WCAG AA, and status is never shown by colour alone.
- Speed budget: app open to answer for the nearest place under 2 s on a mid-range Android.
  Show the cached nearby result immediately, then refresh.
```

---

## Phase 6b: Real phones and web, no App Store

```
Goal: I and a handful of testers can use the app this week on our own iPhones, Android phones and in a browser. No store listing, no store submission.

1. Expo Go first
   - Everything from phase 6 must run in Expo Go (no custom native modules yet).
   - Document `pnpm --filter mobile start` and opening the app by scanning the QR code.

2. Web as a target (same codebase, expo-router web)
   - Platform-specific ports get separate implementations, selected in the composition root via platform-specific files:
     DeviceSession: expo-secure-store on native, cookie/localStorage on web.
     LocationProvider: expo-location on native, browser geolocation on web.
   - Features that only exist natively (share intake, later visit detection) are hidden on web, not stubbed.
   - Static web export (`expo export --platform web`) plus a script that serves it locally.
   - Layout must work on desktop widths too, not just a stretched phone screen.

3. API reachable from phones and browser
   - API base URL comes from EXPO_PUBLIC_API_URL, with a dev default.
   - The API binds to 0.0.0.0 in dev.
   - CORS allowlist from env (local web dev origin + tunnel URL). No wildcard.
   - Add a script that exposes the local API and the web build through Cloudflare quick tunnels (cloudflared) and prints both URLs.

4. EAS internal distribution (needed for phase 7, because share extensions do not run in Expo Go)
   - eas.json with profiles: development (dev client, internal), preview (internal, production-like), production (unused for now).
   - Android preview builds as an installable APK.
   - iOS ad hoc internal distribution. Document registering test devices with `eas device:create`.
   - Bundle identifier and Android package name come from env so I can change them later. App name "amexbutikker".
   - Do not configure App Store or Play submission.

5. Over-the-air updates
   - expo-updates on a "preview" channel so JS-only changes reach testers without a new build.
   - Make it explicit which changes need a new build (native modules, app config, permissions) and which can ship as an update.

6. docs/testing-on-phones.md
   - One-time setup for me, install steps for testers (Android, iPhone, web), and build vs. OTA update rules.

Stop before running any EAS command that needs my Expo or Apple account, and list the exact commands for me to run.
```

---

## Phase 7: Share from Google Maps / Apple Maps

```
- iOS share extension and Android share intent so the app appears in the share sheet of Google Maps and Apple Maps.
  Evaluate expo-share-intent (or an equivalent config plugin) against our Expo SDK. This needs a development build, not Expo Go.
- The app sends the raw shared text to POST /v1/match/shared and never calls Google.
- RegexSharedTextParser implements SharedTextParser: name, street, postcode, city and URLs, Norwegian and English formats.
  Build the tests from real share payloads I will put in data/fixtures/shared/.
- TrigramGeoPlaceMatcher implements PlaceMatcher: trigram name similarity + postcode/street match + distance when coordinates exist.
  Return up to 3 candidates with score and reasons. If the top score clears a threshold and is clearly ahead of number two,
  the app opens the place directly; otherwise it shows the candidates.
- NoopSharedLinkResolver is the only SharedLinkResolver for now. Resolving maps short links is deliberately out of scope.
- Target: share tap to answer on screen in under 1.5 s.
```

---

## Phase 7b: UX pass and first visit detection (done)

```
Done after testing in the iOS Simulator, ahead of Phase 8:
- "Ukjent" renamed "Ikke sjekket" (shown as quiet text in lists). SF Symbols / Material Symbols instead of emoji,
  map-style category colours, navy header, grouped list, solid "Det funket" / "Ble avvist" buttons.
- Bottom tabs: Steder, Innstillinger (a Kart tab joins in Phase 11).
- Visit detection v1 (docs/adr/0001-visit-detection.md): expo-location geofences around up to 18 nearby places,
  ask on leaving after a dwell, announce accepted places on arrival, local notifications with answer buttons,
  rate limits, opt-in under Innstillinger. infra/simulate-visit.sh walks the simulator in and out of a place.
```

---

## Phase 8: Design only, no code

Item 1 is partly done: ADR 0001 covers the geofence version that Phase 7b built. Extend it with CLVisit / DWELL
and per-category dwell rather than writing a new one.

```
Write ADRs in docs/adr/ (context, options, decision, consequences, open questions) for:

1. Visit detection: iOS CLVisit through an Expo native module, Android Geofencing with DWELL.
   Dwell thresholds per category. On-device candidate matching. Ask only when status is unknown, stale or mixed.
   Answers: "Det funket" / "Ble avvist" / "Prøvde ikke".
   Also the reverse: on arrival at a place whose status is accepted, a local notification that the card
   works there ("Her kan du betale med Amex"). Opt-in, at most once per place per day, local notifications only
   (no push server, location never leaves the device). Cover platform region limits (iOS monitors 20 regions,
   Android 100), so the app keeps the nearest accepted places registered as the user moves.
2. Transaction evidence: PSD2 account information through an aggregator. First verify coverage for Norwegian
   American Express cards. Matching of descriptor + visit happens on the device; only place id, result and date leave it.
3. DPIA outline for processing location and transaction data.
```

---

## Phase 9: Visit candidates (done)

```
Geofences in a busy street overlap: at Oslo S ten places are within 20 m. Do not guess.
- When a visit ends, collect every watched place the phone was inside during the visit, not only the region that
  reported the exit first. Rank them by time inside, distance from the fence centre at entry, and how well the dwell
  fits the category (kiosk short, restaurant long). Put the ranking behind a VisitCandidateRanker port, pure and tested.
- One clear candidate: the notification names it, as today.
- Several: "Betalte du med Amex ved <area or nearest street>?"; tapping opens a /visit screen listing the top
  3–5 candidates with "Det funket" / "Ble avvist" on each and "Ingen av disse".
- Rate limits stay per visit, not per place.
- Extend infra/simulate-visit.sh to walk past several places, and test the candidate list in the simulator.
```

---

## Phase 10: iOS widget (done; Android widget open)

```
A home screen and lock screen widget that answers "can I pay with Amex here?" without opening the app.
- The app writes a small snapshot to an App Group: the guessed current place (from the latest geofence enter or
  the nearest place when the app was last open) with its status, and the 3 nearest accepted places with distance.
  The geofence task updates it on enter and asks WidgetKit to reload.
- Small and lock screen: "<place> · Ja / Nei / Varierer / Ikke sjekket". Medium: the 3 nearest places that take Amex.
  Tapping opens the place (deep link).
- Evaluate Expo's widget support (@expo/ui, expo-widgets) against a hand-written SwiftUI extension via a config plugin.
- iOS refreshes widgets a limited number of times a day; show "oppdatert <time>" so a stale answer is visible.
- Android widget later, as its own item.
```

---

## Phase 11: Map tab (done)

Built with OpenFreeMap (no key) instead of MapTiler/Stadia. The "Bare steder med svar" toggle filters on the
server before the cut. Search and Nær deg have chips (Tar Amex, categories, several at once). Open: a perf
test for /v1/places/in-area.

```
A Kart tab showing places as pins coloured by status (with the status symbol, never colour alone).
- No Google APIs: MapLibre (maplibre-react-native) with a vector tile provider that allows app use (MapTiler or
  Stadia free tier; OSM's own tile servers do not). Attribution "© OpenStreetMap contributors" and the provider's.
- New query endpoint for a bounding box (GET /v1/places/in-area), with the same p95 budget as nearby.
  Cluster pins when zoomed out.
- Tapping a pin opens a sheet with name, status and the answer buttons.
```

---

## Phase 12: More evidence sources (OSM done; guide claims and statements wait for input)

```
- OsmOverpassImporter: read payment:american_express=yes|no (and payment:credit_cards=no) as external_list evidence,
  source osm, with the OSM element as sourceRef.
- Curated claims: I paste claims into data/curated-claims.yaml by hand (source, sourceUrl, fetchedAt); chain-level
  claims first, since one claim covers every place in the chain. Never scrape curated lists in bulk.
- Statement importer: finish once I provide an anonymised Amex export (Phase 5 item 4).
```

---

## Phase 11b: Likely answers (done)

Ja / Nei need users' own answers worth `confirmedWeight` (default 1.0); lists, chain claims and a single
user give Trolig ja / Trolig nei. Sources are stored, never shown.

---

## Phase 13: Answer from Apple Pay (built; shared shortcut and phone test open)

```
An iOS Shortcuts "Transaction" automation (iOS 17+) on the user's Amex in Wallet hands merchant, amount and
card to a shortcut, which opens amexbutikker://paid?merchant=…[&amount=…].
- The app matches the merchant to places within ~150 m: one clear match is saved at once with Angre; several
  open the "Hvor betalte du?" list; none is kept as an unmatched descriptor.
- Source `wallet`, weighted like visit_report (one payment gives Trolig ja) until a declined tap is tested:
  the trigger fires on the tap and may fire on a declined payment.
- The amount never leaves the phone (Phase 14 uses it).
- Settings: "Svar automatisk når du betaler", with the shared iCloud shortcut link and a short guide.
  The owner creates and shares the shortcut once; it cannot be published from code.
- Works without it; the shortcut is a bonus.
```

Built: `POST /v1/match/payment` (`MatchPaymentUseCase`, `RegexMerchantNameParser`, stricter decider: 0.7 / 0.2),
`via: 'wallet'` on reports, the `paid` screen, `apps/mobile/src/payments/`, Settings → Apple Pay with the steps.
Open: the app's own Shortcuts action (App Intent) replaced the shared shortcut; test a declined tap on a
phone. See docs/wallet-shortcut.md.

---

## Phase 14: Spending and milestones (on the phone only; 14a, 14b and 14c done)

A personal tab: how much the user has spent on the card and how far they are from a bonus milestone.
Amounts never leave the phone; the server keeps no amounts (unchanged rule).

Built: the Bonus tab, Legg til kjøp, Oppdater total, Nytt mål, in `apps/mobile/src/spending/`. The user picks
their card once (Settings → Kort og mål → Kort); its yearly goals (the companion ticket) are set up and shown big
at the top of the Bonus tab, with spending per month below. A welcome bonus is a goal the user adds (Legg til
mål). The cards come from `GET /v1/cards` (`apps/api/src/cards/cards.model.ts`: all eight Amex cards issued in
Norway; goals for SAS Classic 100 000 kr, Premium 150 000 kr and Elite 150 000 / 300 000 kr per calendar year,
from kredittkortlisten.no and kortio.no, fetched 2026-11-08), so a change needs an API deploy, not an app
release. The owner should check the goals against the issuer's terms before release.

```
14a. Model and tab
- `spending` feature in apps/mobile/src: Purchase { id, date, amountNok, merchant?, placeId?, source:
  manual | wallet | statement | total }, Milestone { id, title, target NOK, period, reward text,
  programmeId? }. Period: calendar year, or a window from a start date (e.g. "9 months from card start").
- Ports: PurchaseStorage, MilestoneStorage (key-value on the phone), MilestoneProgressCalculator
  (spent in period, remaining, days left, kroner per month needed to make it, on pace or not).
- Tab "Bonus": one card per milestone with a progress bar, "x kr igjen", "y kr i måneden for å nå det
  innen <dato>", and a done state. "Legg til kjøp" (amount, date, optional place) and "Oppdater total"
  (type the total from the Amex app; stored as a `total` entry that resets the count from its date).
14b. Preset programmes
- data/card-programmes.yaml: card name, milestones (target, period kind, reward), sourceUrl, fetchedAt.
  Shown with "Sjekk vilkårene hos kortutsteder" and the fetch date; terms change, presets are hints.
- Choosing the card adds its yearly goals; custom milestones alongside. Goals only from sources the owner checks.
14c. Wallet amounts (done): Phase 13's link also takes the amount and stores a `wallet` purchase; a declined
    payment's purchase is removed again.
14d. Statement import: CSV/PDF export from the Amex site, parsed on the phone; needs an anonymised sample.
14e. Households (built): phones sharing one card share Bonus through sealed records the API relays but
    cannot read (XChaCha20-Poly1305, key only in the QR invite). docs/adr/0002-household-sync.md.
```

---

## Phase 15: Hosting at home (in progress)

```
One container (Dockerfile) serves the web app at / and the API at /v1, on amex.johann.no, as an app in the
home simple-k8s next to the media services. CI publishes ghcr.io/vaarvik/amexbutikker (amd64 + arm64).
The owner adds the app, its Postgres (PostGIS, pg_trgm, unaccent) and the nightly refresh job in simple-k8s.
render.yaml stays as a hosted alternative.
```

---

## Phase 16: Trust without accounts (built; needs a dev build, an Apple Team ID and a Turnstile widget)

Reading is open to everyone; answering needs no account. Today: an anonymous device id (Keychain, survives
backups and Quick Start), one counted answer per device and place, rate limits, Ja/Nei only from two answers
or a purchase, decay. The gap is many fake devices.

```
- iOS: App Attest. RegisterDevice takes an attestation; the API checks it with Apple and marks the device
  attested. Unattested devices may still answer, with less weight (a weight entry, not a calculator change).
- Web: Cloudflare Turnstile on RegisterDevice (or on each answer), verified by the API.
Built: `POST /v1/devices/me/challenge` and `/attestation`, `AppleAppAttestValidator` (chain to Apple's root,
nonce, key id, app id, counter, AAGUID), `HttpTurnstileValidator`, `unverified_report` (weight 0.3) for devices
that are not attested, whose `via: 'wallet'` is ignored (`AttestationReportEvidencePolicy`). App: the local Expo
module `modules/app-attest` (Swift, DCAppAttestService) runs once per device token at start; the web runs an
interaction-only Turnstile widget. Open: a new dev/EAS build for the native module, then a test on a real iPhone
(the simulator has no App Attest); the owner's Team ID and a Turnstile widget. Assertions per request (App Attest
`generateAssertion`) are not used: the attestation at registration is the gate.

- Later, only if wanted: iCloud key-value sync for the Bonus tab (no server, no account), and an optional
  Keycloak login (Google, Apple, e-mail) that links the anonymous user, for one identity on phone and web.
  A login with Google needs Sign in with Apple in the iOS app too.
```

---

## Open items

- Real share payloads for data/fixtures/shared/ (the current six are synthetic).
- A stable public API address before any preview build for testers.
