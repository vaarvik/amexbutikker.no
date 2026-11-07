# amexbutikker

Crowdsourced answer to "does this place accept American Express?" in Norway.
Primary job: give the answer in under a second, from search, from "near me", or from a place the user shared from Google Maps / Apple Maps.
Not affiliated with American Express. Never use Amex logos or brand assets.

## Stack

- pnpm workspaces monorepo, TypeScript everywhere, Node LTS
- Backend: Fastify (HTTP adapter only), Kysely, PostgreSQL 16 + PostGIS + pg_trgm + unaccent
- Runtime validation: zod at every boundary
- Mobile: Expo (React Native) with expo-router
- Tests: Vitest, Testcontainers for Postgres
- Local infra: Docker Compose

## Repo layout

```
packages/contracts     Interfaces only: ports, use case interfaces, DTOs, branded IDs, zod schemas, typed errors, contract test kits
packages/domain        Domain services and value objects. Pure, no I/O
packages/application   Use cases, one class per use case
packages/in-memory     InMemory* adapters for every port (tests, local dev, `STORAGE=memory`)
apps/api               Fastify adapter, Postgres adapters, importers, composition root
apps/mobile            Expo app
tools/contract-check   ts-morph script that enforces the rules below in CI
data/                  Curated seed files (YAML), share-payload fixtures
docs/adr/              Architecture decision records
```

Packages are layers; inside each layer, code is grouped by feature (see Domain-driven design below). Same feature names in every layer:

```
packages/contracts/src/<feature>/      <feature>.{model,ports,use-cases,dtos}.ts (see File naming)
packages/contracts/src/shared/         shared.{model,ports,dtos,errors}.ts
packages/contracts/src/unit-of-work.ts cross-feature
packages/contracts/test-kit/<feature>/ <feature>.contract.ts; fixture.ts and test-data.ts at the root
packages/domain/src/<feature>/         domain services
packages/application/src/<feature>/    use case classes
packages/in-memory/src/<feature>/      InMemory* adapters
apps/api/src/<feature>/                controllers, Pg* adapters, other adapters, side by side
apps/api/src/imports/importers/<source>/   one importer per source; folder = source id in kebab-case (rule (g))
apps/api/src/migrations/               all migrations, one ordered sequence (not per feature)
apps/api/src/composition-root.ts
apps/mobile/src/<feature>/              non-visual services (classes behind ports), same rules as apps/api
apps/mobile/src/app/                    expo-router screens; apps/mobile/src/ui/ shared components
apps/mobile/src/composition-root.ts
<package>/test/<feature>/              tests, mirroring src (see Testing)
```

Features: `places`, `chains`, `evidence`, `status`, `reports`, `shared-match`, `imports`, `devices`. The app also has `visits` (visit detection, phone only; docs/adr/0001-visit-detection.md) `widgets` (the iOS home screen widget, laid out in `src/ui/nearby-widget.ios.tsx`) and `spending` (the Bonus tab: card spending and milestones, stored on the phone only; amounts never reach the API).

- Folders are one level deep. Relationships between features are expressed by imports, not by nesting.
- Nest X under Y only if X cannot exist without Y and nothing else uses X.
- `shared/` holds what two or more features use. `shared/` never imports from a feature.
- Each package exposes everything through its root `index.ts`; consumers import `@amexbutikker/<package>`, never deep paths.
- Feature folders in `apps/api/src` are flat: the role is in the file name (`places.controller.ts`, `pg-place.repository.ts`), not in a subfolder.

### File naming

Every folder of the same kind looks alike. Names are kebab-case. Contracts files, types and ports start with the domain noun; class files start with the class name, which puts the mechanism first (`pg-place.repository.ts`).

Contracts: a feature folder contains only these files, each prefixed with the folder name, and only the ones it needs:

| File                     | Contains                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `<feature>.model.ts`     | Data types and their zod schemas: entities, value objects, queries, read models, constants |
| `<feature>.ports.ts`     | Repository and service interfaces                                                          |
| `<feature>.use-cases.ts` | Use case interfaces with their input and output types                                      |
| `<feature>.dtos.ts`      | HTTP request and response DTOs with schemas                                                |
| `<feature>.errors.ts`    | Error classes (only `shared/` so far)                                                      |

Test kit: `<feature>.contract.ts` exports `describe<Port>Contract` functions.

Everywhere else (rule (f)): one exported class per file, Error subclasses aside. The file exports nothing else except the class's constructor config, named `<Class>Config` (`OverpassOsmImporterConfig`); ports go to `<folder>.ports.ts`, other data types and constants to `<folder>.model.ts`. The file is named after the class in kebab-case with a dot before the role:

- `CreatePlaceUseCase` → `create-place.use-case.ts`
- `PgPlaceRepository` → `pg-place.repository.ts`
- `PgUnitOfWork` → `pg.unit-of-work.ts`
- `PlacesController` → `places.controller.ts`
- `M0003EvidenceMigration` → `m0003-evidence.migration.ts`

The class name must end in a known role:

`use-case`, `unit-of-work`, `repository`, `controller`, `migration`, `provider`, `calculator`, `policy`, `selector`, `summarizer`, `decider`, `similarity`, `validator`, `refresher`, `mapper`, `authenticator`, `server`, `importer`, `parser`, `matcher`, `resolver`, `generator`, `clock`, `logger`, `rate-limiter`, `translator`, `factory`, `service`, `rule`, `checker`, `loader`, `reporter`, `heritage`, `paths`, `reader`, `writer`, `client`, `locator`, `session`, `cache`, `storage`, `transport`, `presenter`, `monitor`, `notifier`, `ranker`.

To add a role, add it to `ClassFileNamingRule` and this list in the same change.

A file without a class is `<folder>.ports.ts` (interfaces) or `<folder>.model.ts` (data types and constants), named after its folder like the contracts files: `shared/shared.ports.ts`, `osm-overpass/osm-overpass.model.ts`. Directly in a package's `src/`, it takes the package folder's name: `tools/contract-check/src/contract-check.ports.ts`.

Exempt from rule (f):

- entry points: `index.ts`, `cli.ts`, `server.ts`, `migrate.ts`, `composition-root.ts` (and the mobile `composition-root.<part>.ts` files)
- tests and the test kit
- `packages/contracts/src`, which rule (e) covers

Code names:

- Types, interfaces and ports start with the domain noun: `PlaceReader`, `PlaceStatus`, `ChainHint`.
- Implementations are `<Mechanism><Noun><Role>`. The mechanism says how it works: `Pg`, `InMemory`, `Http`, `DiskCaching`, `Grid`, `Allowlist`, `Fixed`, `Null` (does nothing on purpose). `Default`, `Basic`, `Simple`, `Generic`, `Standard` and `Impl` say nothing and are rejected by rule (f).
- Use cases are verb + noun, because they are commands: `SubmitReport`, implemented by `SubmitReportUseCase`.
- One class may implement a feature's reader and writer ports together: `<Mechanism><Noun>Repository` (`InMemoryPlaceRepository`, `PgPlaceRepository`). Consumers still depend on the single port they use.
- Methods do not repeat the noun: `placeReader.getById()`, not `getPlaceById()`.

contract-check rule (e) enforces the contracts file names.

Importers: each folder in `apps/api/src/imports/importers/` is the source id in kebab-case (`osm_overpass` → `osm-overpass/`) and holds exactly one `*.importer.ts` whose `source` is that id. Importer folders are one level deep. contract-check rule (g) enforces this.

## Architecture patterns

Ports and adapters (the layering above), DDD inside it (below), and CQS / CQRS-lite between them.

### CQRS-lite

- **Commands** change state and are named by intent: `SubmitReport`, `RemoveMyReport`, `CreatePlace`, `RegisterDevice`, `RunImport`. The API is task-based (`POST /v1/places/:id/reports`), not CRUD on tables.
- **Queries** read and never write: `SearchPlaces`, `ListNearbyPlaces`, `GetPlaceDetails`, `MatchSharedPlace`.
- **Write model:** append-only `evidence`. **Read models:** `place_status` and `chain_hints`, recalculated by `PlaceStatusRefresher` in the same unit of work as the evidence change.
- One database, one model package. No separate read store, no event bus. That is the "lite".
- Commands return the new status on purpose, so the app can update without a second request. That is a deliberate deviation from strict CQS.

### Method verbs

| Verb      | Returns                         | When nothing matches   |
| --------- | ------------------------------- | ---------------------- |
| `get…`    | exactly one item                | throws `NotFoundError` |
| `find…`   | one item or `null`              | `null`                 |
| `list…`   | an array, or a map keyed by id  | `[]` / empty map       |
| `search…` | ranked hits for free-text input | `[]`                   |

Writes use `create`, `save…` (replace), `append` (evidence) and `upsert…` (imports).

contract-check rule (h) holds every `*Reader` port method to the read verbs and every `*Writer` port method to the write verbs, in any `*.ports.ts`. Other ports (`OverpassClient.fetch`, `OsmAddressLocator.nearest`) name their action freely.

## Domain-driven design

Code follows DDD's tactical patterns inside the layering above (ports and adapters).

### Ubiquitous language

Use these words, with these meanings, in code, docs and conversation. UI copy uses the Norwegian in brackets.

- **Place** (sted/butikk): something that may accept the card. `physical` (has a location, may belong to a chain) or `online` (a checkout, no location). Not "store" or "merchant" in code.
- **Chain** (kjede): a brand with several physical places.
- **Evidence**: one observation that a place or chain accepts or rejects the card. Append-only.
- **Report** (rapport): evidence a user submits from the app (`user_report`). Can be withdrawn by appending `withdrawn`.
- **Status** (svar): the computed answer for a place: accepted (Ja), likely_accepted (Trolig ja), rejected (Nei), likely_rejected (Trolig nei), mixed (Varierer), unknown (Ikke sjekket). Ja/Nei need users' own answers worth `confirmedWeight` (default 1.0: two fresh reports or one purchase); lists and chain claims alone only ever give Trolig.
- **Basis**: the strongest evidence kind behind a status.
- **Chain hint**: "7 of 9 places in this chain accept". Shown next to a status, never used as one.
- **Claim**: one entry from a curated or external list, imported as evidence.
- **Shared place**: text shared from a maps app, before it is matched to a place.

### Building blocks

| DDD concept           | Here                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| Entity                | `Place`, `Chain` (identity via branded id)                                                                    |
| Value object          | `GeoPoint`, `Address`, `PlaceStatus`, `ChainHint`. Immutable, compared by value                               |
| Aggregate root        | `Place` (with its status snapshot), `Chain` (with its hint). Others refer to them by id only                  |
| Repository            | `*Reader` / `*Writer` ports, split by consumer                                                                |
| Domain service        | `packages/domain` classes, e.g. `DecayingAcceptanceStatusCalculator`. Pure                                    |
| Application service   | One use case class per `packages/application` file. Orchestrates, holds no business rules                     |
| Anti-corruption layer | Importers and `SharedTextParser`: translate outside data into the model; outside formats never reach `domain` |

### Bounded contexts

- **Acceptance** (core domain): places, chains, evidence, status, reports. Most design effort goes here.
- **Imports**: OSM, Brreg, curated claims, statements. Own record types (`PlaceSourceRecord`, `ChainSourceRecord`) and translation into the core.
- **Shared match**: parsing shared text and matching it to places. Own type (`ParsedSharedPlace`).
- **Devices** (generic): anonymous auth and rate limiting. Keep it simple.

### Deliberate deviations

- Entities are plain data (rule 4), not classes with methods. Behaviour lives in domain services. This is a conscious trade-off for zod validation and serialisation, not an oversight.
- No event sourcing: evidence is append-only, but the status is a stored snapshot recalculated on change, not rebuilt by replay.
- No domain events yet. Introduce them only when a second consumer of the same fact appears.

## Testing

- **Where:** each package has `test/` mirroring `src/`: `src/places/create-place.use-case.ts` is tested in `test/places/create-place.use-case.test.ts`. Shared test helpers sit in `test/shared/`.
- **Suffixes:**
  - `*.test.ts`: unit. No network, no Docker. A file adapter may use its own temp directory (`fs.mkdtemp`, removed after the test), and a test may read checked-in fixtures under `data/fixtures/`; nothing else touches the disk.
  - `*.integration.test.ts`: needs Docker (Testcontainers).
  - `*.api.test.ts`: HTTP through Fastify `inject`.
  - `*.perf.test.ts`: latency budget (p95 < 100 ms) and query plans on seeded data. Only `pnpm test:perf` runs them; CI runs them in a separate `perf` job.
- **Perf on Apple silicon:** the PostGIS image is amd64 only and runs emulated, about 30× slower. Locally the perf tests check query plans and skip the latency budget; CI enforces it on native Postgres.
- **Contract suites:** each port's suite lives in `packages/contracts/test-kit/<feature>/<feature>.contract.ts`. It runs against every implementation: in-memory in `packages/in-memory/test/<feature>/`, Postgres in `apps/api/test/shared/postgres.contracts.integration.test.ts`, which uses one container for all Pg suites.
- **When to write tests:**
  - Test-first (TDD) for domain services and use cases.
  - Contract-first for ports: the suite exists before any implementation.
  - Adapters and wiring may be tested after, but before the change is done.
- **Coverage floors:** enforced by `pnpm test:coverage`, which CI runs.
  - `packages/domain/src`: 100 %
  - `packages/application/src`: 95 %
  - `packages/in-memory/src`, `apps/api/src` and `apps/mobile/src`: 90 %
  - Entry points and the composition roots are excluded, and so are the mobile screens and components (`apps/mobile/src/app`, `apps/mobile/src/ui`).
  - A floor is a floor: cover a gap with a test of the behaviour, not a test of the line.
  - Domain code must not need integration tests to reach 100 %.

## Non-negotiable rules

### Interface first

1. New behaviour starts as an interface in `packages/contracts`. Show the interface for review before implementing it, unless the prompt explicitly says to implement.
2. Every class with behaviour `implements` at least one interface. Interfaces are named by role (`PlaceReader`), implementations by mechanism (`PgPlaceReader`, `InMemoryPlaceReader`). No `I` prefix.
3. Depend on interfaces only. The only place allowed to `new` application or infrastructure classes is the composition root (`apps/api/src/composition-root.ts`, `apps/mobile/src/composition-root.ts`) and tests.
4. Data is `interface` / `type`. Behaviour is `class`. Do not wrap plain data in classes. Do not export free functions with behaviour from `packages/application` or `apps/*`.
5. Typed errors are classes (`DomainError` and subclasses). They are the one exception to rule 4.

### Class style

- Constructor injection only, dependencies as `private readonly`. No service locator, no module-level singletons, no static mutable state.
- Explicit member accessibility on every member. `override` where applicable.
- No default exports.
- Use cases expose exactly one public method: `execute(input): Promise<Output>`.

### SOLID, concretely

- **S:** one use case per class. Split repositories into reader and writer ports when consumers differ.
- **O:** a new evidence source means a new `SourceImporter` implementation plus a weight entry in the `EvidenceWeightPolicy` config. The status calculator must not change.
- **L:** every port has a shared contract test suite in `packages/contracts/test-kit` (`describePlaceReaderContract(factory)` etc.) that runs against every implementation, in-memory and Postgres. An implementation is not done until it passes.
- **I:** small role interfaces. No consumer depends on methods it does not call.
- **D:** `packages/domain` and `packages/application` never import from `apps/*`, Fastify, Kysely, pg, Expo, React Native or any SDK.

### Contracts are compile-time only

TypeScript interfaces disappear at runtime, and TypeScript is structurally typed. Therefore:

- Every HTTP request and response, DB row mapping, imported file and shared-text payload is parsed with zod.
- Schemas are typed against their interface so they cannot drift: `export const PlaceDtoSchema: z.ZodType<PlaceDto> = z.object({ ... })`.
- IDs are branded types (`PlaceId`, `ChainId`, `UserId`, `EvidenceId`, `ImportRunId`) so they cannot be mixed.
- `tools/contract-check` enforces the class and import rules. CLAUDE.md is guidance; the check is what fails the build.

### UI exception

React components in `apps/mobile` are function components, because class components cannot use hooks. Everything non-visual in the app (API client, session, location, share handling, caching) follows the class and interface rules and is injected through a React context that holds the composition root (`useServices()`). contract-check covers `apps/mobile/src` except `app/` and `ui/`. Mobile files import each other without extensions (Metro); Metro maps the workspace packages' `./x.js` imports to `./x.ts` (`apps/mobile/metro.config.js`).

### TypeScript

`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. No `any`. Use `unknown` plus zod at boundaries.

## Domain essentials

- **Place** is either `physical` (has a location, may belong to a Chain) or `online` (no location, one checkout).
- **Evidence** is append-only: `kind`, `result` (`accepted` | `rejected`), `source`, `sourceRef`, `observedAt`, `importedAt`, optional `userId`. Never update or delete evidence. Newer evidence supersedes older.
- Evidence kinds, strongest first: `transaction`, `visit_report`, `user_report`, `chain_confirmation`, `external_list`, `checkout_logo`.
- For a given user and place, only that user's latest evidence counts.
- **Status** per place is always computed, never written by hand: `accepted` | `likely_accepted` | `rejected` | `likely_rejected` | `mixed` | `unknown`, plus `confidence`, `basis` (the evidence kind that decided it), `verified` (any transaction or visit evidence) and `lastEvidenceAt`.
- Precedence for a physical place: its own direct evidence, then chain confirmation, then nothing. The **chain hint** ("7 of 9 stores in this chain accept") is shown alongside, never used as the status.
- All weights and half-lives live in one `EvidenceWeightPolicy` implementation, configured through its constructor.
- External sources are seeds. They are shown as "unconfirmed, according to <source> (fetched <date>)" until users confirm or contradict them.

## Data source rules

- No Google APIs in this iteration. Places come from OpenStreetMap (Overpass, Oslo first) and Brønnøysundregisteret (underenheter).
- Never scrape Amexvenn.no or other curated lists in bulk. Curated claims enter through `data/curated-claims.yaml`, with `source` and `fetchedAt` on every claim.
- Everything imported stores `sourceRef` and `fetchedAt`. Imports are idempotent and logged in `import_runs`.

## Commands

Node 24 (`.nvmrc`), pnpm 10 (pinned in `packageManager`). TypeScript 6.0 everywhere (Expo SDK 58 pins it; TS 7 is avoided because ts-morph and typescript-eslint need the JS compiler API).

```bash
pnpm install                 # install everything
pnpm typecheck               # tsc -b over the project references + tsc --noEmit for apps/mobile
pnpm lint                    # ESLint (strict-type-checked), zero warnings allowed
pnpm format                  # Prettier write; `pnpm format:check` in CI
pnpm test                    # Vitest, all projects; needs Docker (Testcontainers). `pnpm test --project domain` for one
pnpm test:unit               # everything except *.integration.test.ts; no Docker needed
pnpm test:coverage           # all tests plus coverage floors (what CI runs)
pnpm test:perf               # *.perf.test.ts: 50k seeded places, p95 budget and query plans; needs Docker
pnpm contract-check          # architecture rules (a)-(h) from tools/contract-check
pnpm db:up                   # Postgres 16 + PostGIS/pg_trgm/unaccent via Docker Compose
pnpm db:down                 # stop it (data persists in the db-data volume)
pnpm db:migrate              # build api, migrate DATABASE_URL (from .env) to latest
pnpm db:migrate:down         # revert the last migration
pnpm run import <source>     # run an importer (osm_overpass, ...); add --dry-run to roll back. `pnpm import` is a pnpm builtin
pnpm refresh-statuses        # recalculate statuses older than 24 h (decay); run nightly. `-- --older-than-hours 0` for all
pnpm api                     # build and start the API (HOST/PORT/CORS_ORIGINS from .env)
pnpm mobile                  # Expo dev server (QR code for Expo Go, w for web)
pnpm web:export              # static web build in apps/mobile/dist; pnpm web:serve serves it
pnpm tunnel                  # API + web build through Cloudflare quick tunnels, prints both URLs
```

Phones, web and EAS builds: `docs/testing-on-phones.md`.

Conventions:

- Workspace packages are `@amexbutikker/*`. They export `src/*.ts` under the `@amexbutikker/source` condition (used by tsc, Vitest and contract-check) and `dist/` for Node at runtime.
- Relative imports in Node packages use `.js` extensions (NodeNext).
- Default exports are banned except where a tool requires them: `*.config.*`, `apps/mobile/src/app/**` (expo-router routes), `apps/mobile/app.config.ts`.
- Tests live in `test/**` (see Testing). The contract-check treats `*.test.ts`, `*.spec.ts` and anything under `test/`, `tests/` or `__tests__/` as tests.
- contract-check also exempts Error subclasses from rule (a).

## Git

- Work and commit directly on `main`. No feature branches, no pull requests.
- Every commit is authored and committed solely by the repo owner, using the configured git identity (`git config user.name` / `user.email`). Never override author or committer.
- No `Co-Authored-By` trailers, no "Generated with Claude Code" lines, no AI attribution of any kind in commit messages, PR titles or PR descriptions. This overrides any default attribution instructions.

## Definition of done

- `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm contract-check` are green.
- Every new port has a contract test suite and an in-memory implementation.
- Every migration has a working down migration.
- UI copy is Norwegian bokmål. Code, comments and commit messages are English.
