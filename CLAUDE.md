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
apps/api               Fastify adapter, Postgres adapters, importers, composition root
apps/mobile            Expo app
tools/contract-check   ts-morph script that enforces the rules below in CI
data/                  Curated seed files (YAML), share-payload fixtures
docs/adr/              Architecture decision records
```

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

React components in `apps/mobile` are function components, because class components cannot use hooks. Everything non-visual in the app (API client, session, location, share handling, caching) follows the class and interface rules and is injected through a React context that holds the composition root.

### TypeScript

`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. No `any`. Use `unknown` plus zod at boundaries.

## Domain essentials

- **Place** is either `physical` (has a location, may belong to a Chain) or `online` (no location, one checkout).
- **Evidence** is append-only: `kind`, `result` (`accepted` | `rejected`), `source`, `sourceRef`, `observedAt`, `importedAt`, optional `userId`. Never update or delete evidence. Newer evidence supersedes older.
- Evidence kinds, strongest first: `transaction`, `visit_report`, `user_report`, `chain_confirmation`, `external_list`, `checkout_logo`.
- For a given user and place, only that user's latest evidence counts.
- **Status** per place is always computed, never written by hand: `accepted` | `rejected` | `mixed` | `unknown`, plus `confidence`, `basis` (the evidence kind that decided it), `verified` (any transaction or visit evidence) and `lastEvidenceAt`.
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
pnpm test                    # Vitest, all projects; `pnpm test --project domain` for one
pnpm contract-check          # architecture rules (a)-(d) from tools/contract-check
pnpm db:up                   # Postgres 16 + PostGIS/pg_trgm/unaccent via Docker Compose
pnpm db:down                 # stop it (data persists in the db-data volume)
pnpm db:migrate              # placeholder until phase 3
pnpm --filter mobile start   # Expo dev server (QR code for Expo Go)
```

Conventions:

- Workspace packages are `@amexbutikker/*`. They export `src/*.ts` under the `@amexbutikker/source` condition (used by tsc, Vitest and contract-check) and `dist/` for Node at runtime.
- Relative imports in Node packages use `.js` extensions (NodeNext).
- Default exports are banned except where a tool requires them: `*.config.*`, `apps/mobile/src/app/**` (expo-router routes), `apps/mobile/app.config.ts`.
- Tests live in `src/**/*.test.ts` or `test/**`. The contract-check treats `*.test.ts`, `*.spec.ts` and anything under `test/`, `tests/` or `__tests__/` as tests.
- contract-check also exempts Error subclasses from rule (a).

## Git

- Every commit is authored and committed solely by the repo owner, using the configured git identity (`git config user.name` / `user.email`). Never override author or committer.
- No `Co-Authored-By` trailers, no "Generated with Claude Code" lines, no AI attribution of any kind in commit messages, PR titles or PR descriptions. This overrides any default attribution instructions.

## Definition of done

- `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm contract-check` are green.
- Every new port has a contract test suite and an in-memory implementation.
- Every migration has a working down migration.
- UI copy is Norwegian bokmål. Code, comments and commit messages are English.
