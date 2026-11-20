import {
  CompletePasskeyRegistrationUseCase,
  CompletePasskeySignInUseCase,
  RenewAccessSessionUseCase,
  StartPasskeyRegistrationUseCase,
  StartPasskeySignInUseCase,
  AppendHouseholdRecordsUseCase,
  AttestDeviceUseCase,
  CreateHouseholdUseCase,
  GetMyHouseholdUseCase,
  JoinHouseholdUseCase,
  LeaveHouseholdUseCase,
  ListHouseholdRecordsUseCase,
  ListCardsUseCase,
  CalculatingPlaceStatusRefresher,
  CreatePlaceUseCase,
  ListNearbyPlacesUseCase,
  ListPlacesInAreaUseCase,
  GetPlaceDetailsUseCase,
  IssueAttestationChallengeUseCase,
  MatchPaymentUseCase,
  MatchSharedPlaceUseCase,
  RegisterDeviceUseCase,
  RemoveMyReportUseCase,
  RefreshStaleStatusesUseCase,
  RunImportUseCase,
  SeedImportsUseCase,
  SearchPlacesUseCase,
  SubmitReportUseCase,
  ZodInputValidator,
} from '@amexbutikker/application';
import type {
  ImportRunReader,
  SeedImports,
  PasskeyReader,
  PasskeyWriter,
  HouseholdReader,
  HouseholdWriter,
  AppAttestValidator,
  ChainReader,
  DeviceReader,
  DeviceWriter,
  EvidenceReader,
  ImportRunWriter,
  PlaceReader,
  PlaceStatusReader,
  PlaceWriter,
  RefreshStaleStatuses,
  RunImport,
  TransactionalPorts,
  TurnstileValidator,
  UnitOfWork,
  UnmatchedDescriptorWriter,
} from '@amexbutikker/contracts';
import {
  AttestationReportEvidencePolicy,
  DecayingAcceptanceStatusCalculator,
  FixedEvidenceWeightPolicy,
  LatestEvidenceSummarizer,
  NameDistancePlaceDuplicateMatcher,
  ProportionChainHintCalculator,
  RegexSharedTextParser,
  SupersedingEvidenceSelector,
  RegexMerchantNameParser,
  ThresholdMatchDecider,
  TrigramNameSimilarity,
} from '@amexbutikker/domain';
import { Kysely, PostgresDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import pg from 'pg';
import { join } from 'node:path';
import { createRemoteJWKSet } from 'jose';
import { pino } from 'pino';
import { z } from 'zod';
import {
  EmptyInMemoryTablesFactory,
  InMemoryChainRepository,
  InMemoryCardReader,
  InMemoryDeviceRepository,
  InMemoryPasskeyRepository,
  InMemoryHouseholdRepository,
  InMemoryEvidenceRepository,
  InMemoryImportRunRepository,
  InMemoryUnmatchedDescriptorRepository,
  InMemoryPlaceRepository,
  InMemoryPlaceStatusRepository,
  InMemoryRateLimiter,
  InMemoryUnitOfWork,
} from '@amexbutikker/in-memory';
import { PgChainRepository } from './chains/pg-chain.repository.js';
import { HealthController } from './shared/health.controller.js';
import { StaticWebController } from './shared/static-web.controller.js';
import { AccessController } from './access/access.controller.js';
import { FixedPasskeyInviteValidator } from './access/fixed-passkey-invite.validator.js';
import { HmacAccessSessionService } from './access/hmac-access-session.service.js';
import { HmacPasskeyChallengeService } from './access/hmac-passkey-challenge.service.js';
import { PgPasskeyRepository } from './access/pg-passkey.repository.js';
import { SessionCookieAccessAuthenticator } from './access/session-cookie-access.authenticator.js';
import { WebAuthnPasskeyService } from './access/web-authn-passkey.service.js';
import { CardsController } from './cards/cards.controller.js';
import { CARD_CATALOGUE } from './cards/cards.model.js';
import { AppleAppAttestValidator } from './devices/apple-app-attest.validator.js';
import { APPLE_APP_ATTESTATION_ROOT_CA_PEM } from './devices/devices.model.js';
import { DevicesController } from './devices/devices.controller.js';
import { HouseholdsController } from './households/households.controller.js';
import { PgHouseholdRepository } from './households/pg-household.repository.js';
import { Sha256JoinTokenHasher } from './households/sha256-join-token.hasher.js';
import { HmacAttestationChallengeService } from './devices/hmac-attestation-challenge.service.js';
import { HttpTurnstileValidator } from './devices/http-turnstile.validator.js';
import { UnconfiguredAppAttestValidator } from './devices/unconfigured-app-attest.validator.js';
import { UnconfiguredTurnstileValidator } from './devices/unconfigured-turnstile.validator.js';
import { HmacDeviceTokenService } from './devices/hmac-device-token.service.js';
import { PgDeviceRepository } from './devices/pg-device.repository.js';
import { PgEvidenceRepository } from './evidence/pg-evidence.repository.js';
import { AddressBrregPlaceMatcher } from './imports/importers/brreg-underenheter/address-brreg-place.matcher.js';
import { BrregUnderenhetImporter } from './imports/importers/brreg-underenheter/brreg-underenhet.importer.js';
import { OSLO_KOMMUNENUMMER } from './imports/importers/brreg-underenheter/brreg-underenheter.model.js';
import { CachedBrregUnderenhetReader } from './imports/importers/brreg-underenheter/cached-brreg-underenhet.reader.js';
import { FsTextFileLoader } from './imports/fs-text-file.loader.js';
import { CuratedListImporter } from './imports/importers/curated-list/curated-list.importer.js';
import { TagOsmElementTranslator } from './imports/importers/osm-overpass/tag-osm-element.translator.js';
import { DiskCachingOverpassClient } from './imports/importers/osm-overpass/disk-caching-overpass.client.js';
import { GridOsmAddressLocator } from './imports/importers/osm-overpass/grid-osm-address.locator.js';
import { HttpOverpassClient } from './imports/importers/osm-overpass/http-overpass.client.js';
import { OSLO_AREA_ID } from './imports/importers/osm-overpass/osm-overpass.model.js';
import { OverpassOsmImporter } from './imports/importers/osm-overpass/overpass-osm.importer.js';
import { PgImportRunRepository } from './imports/pg-import-run.repository.js';
import { PgUnmatchedDescriptorRepository } from './imports/pg-unmatched-descriptor.repository.js';
import { NullMerchantDescriptorMatcher } from './imports/importers/statement/null-merchant-descriptor.matcher.js';
import { StatementImporter } from './imports/importers/statement/statement.importer.js';
import { UnconfiguredStatementParser } from './imports/importers/statement/unconfigured-statement.parser.js';
import { TransactionalImportUnitOfWork } from './imports/transactional-import.unit-of-work.js';
import { AllMigrationsProvider } from './migrations/all-migrations.provider.js';
import { PlacesController } from './places/places.controller.js';
import { PgPlaceRepository } from './places/pg-place.repository.js';
import { ReportsController } from './reports/reports.controller.js';
import { FastifyHttpServer } from './shared/fastify-http.server.js';
import { JwksAccessAuthenticator } from './shared/jwks-access.authenticator.js';
import { NullAccessAuthenticator } from './shared/null-access.authenticator.js';
import { NullSharedLinkResolver } from './shared-match/null-shared-link.resolver.js';
import { SharedMatchController } from './shared-match/shared-match.controller.js';
import { TrigramGeoPlaceMatcher } from './shared-match/trigram-geo-place.matcher.js';
import { DomainHttpErrorMapper } from './shared/domain-http-error.mapper.js';
import { AllowlistHttpDtoMapper } from './shared/allowlist-http-dto.mapper.js';
import { BearerTokenAuthenticator } from './shared/bearer-token.authenticator.js';
import type { InMemoryTables } from '@amexbutikker/in-memory';
import { SystemClock } from './shared/system.clock.js';
import { UuidV7IdGenerator } from './shared/uuid-v7-id.generator.js';
import type { Database } from './shared/shared.model.js';
import { PgDatabaseErrorTranslator } from './shared/pg-database-error.translator.js';
import { PgUnitOfWork } from './shared/pg.unit-of-work.js';
import { PgPlaceStatusRepository } from './status/pg-place-status.repository.js';
import type { AccessAuthenticator, HttpServer } from './shared/shared.ports.js';

const RateLimitRuleSchema = z.object({
  limit: z.int().positive(),
  windowSeconds: z.int().positive(),
});

export interface ApiConfig {
  /** `memory` keeps everything in process; for tests and quick demos. */
  readonly storage: 'postgres' | 'memory';
  /** Required when storage is postgres. */
  readonly databaseUrl?: string;
  readonly deviceTokenSecret: string;
  readonly host: string;
  readonly port: number;
  readonly logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  readonly trustProxy: boolean;
  /**
   * Browser origins allowed to call the API (the web app, a tunnel URL). Exact origins only;
   * empty disables CORS, so browsers on other origins are refused.
   */
  readonly corsOrigins: readonly string[];
  readonly rateLimits: Readonly<Record<string, z.infer<typeof RateLimitRuleSchema>>>;
  readonly imports: ImportsConfig;
  /** The web app's static export to serve at `/`; unset serves the API only. */
  readonly webRoot?: string;
  readonly attestation: AttestationConfig;
  /**
   * A private deployment behind Cloudflare Access: every request but `/health` must carry a
   * valid Access login. Unset: open to everyone.
   */
  readonly access?: AccessConfig;
  /**
   * A private deployment with its own sign-in: every `/v1` request but sign-in needs the session
   * cookie of a stored passkey. Not together with `access`. Unset: open to everyone.
   */
  readonly passkeys?: PasskeysConfig;
}

export interface PasskeysConfig {
  /** The site's exact origin, `https://amex.johann.no`; passkeys are bound to its host. */
  readonly origin: string;
  /** The code that lets someone add a passkey; unset, no one can add one. */
  readonly inviteCode?: string;
}

export interface AccessConfig {
  /** The team domain, `https://<team>.cloudflareaccess.com`. */
  readonly teamDomain: string;
  /** The Access application's audience tag. */
  readonly audience: string;
}

/** Phase 16: proving a device is a real install of the app (docs/hosting.md). */
export interface AttestationConfig {
  /**
   * Count answers from devices that are not attested in full. Only for local development and the
   * simulator, where App Attest does not exist. Default false.
   */
  readonly trustUnattested: boolean;
  /** `<Team ID>.<bundle id>` of each iOS build allowed to attest; empty turns App Attest off. */
  readonly appAttestAppIds: readonly string[];
  /** Also accept development builds (the `appattestdevelop` environment). */
  readonly appAttestDevelopment: boolean;
  /** Cloudflare Turnstile secret; unset turns Turnstile off. */
  readonly turnstileSecretKey?: string;
  /** Hostnames the Turnstile widget may be solved on; empty accepts any. */
  readonly turnstileHostnames: readonly string[];
}

export interface ImportsConfig {
  readonly overpassUrl: string;
  /** Overpass area id; Oslo kommune by default. */
  readonly overpassAreaId: number;
  /** Where fetched source data is cached between runs. */
  readonly cacheDir: string;
  readonly cacheMaxAgeHours: number;
  readonly curatedClaimsPath: string;
  /** The statement export to import; outside git (data/statements/ is ignored). */
  readonly statementPath: string;
}

const IMPORT_USER_AGENT = 'amexbutikker-importer/0.1 (+https://github.com/vaarvik/amexbutikker.no)';

export const DEFAULT_IMPORTS: ImportsConfig = {
  overpassUrl: 'https://overpass-api.de/api/interpreter',
  overpassAreaId: OSLO_AREA_ID,
  cacheDir: 'data/cache',
  cacheMaxAgeHours: 7 * 24,
  curatedClaimsPath: 'data/curated-claims.yaml',
  statementPath: 'data/statements/statement.txt',
};

export const DEFAULT_ATTESTATION: AttestationConfig = {
  trustUnattested: false,
  appAttestAppIds: [],
  appAttestDevelopment: false,
  turnstileHostnames: [],
};

export const DEFAULT_RATE_LIMITS: ApiConfig['rateLimits'] = {
  submit_report: { limit: 30, windowSeconds: 3600 },
  create_place: { limit: 10, windowSeconds: 3600 },
  register_device: { limit: 20, windowSeconds: 3600 },
  attest_device: { limit: 10, windowSeconds: 3600 },
  create_household: { limit: 5, windowSeconds: 86400 },
  join_household: { limit: 10, windowSeconds: 3600 },
  append_household_records: { limit: 200, windowSeconds: 3600 },
  // One household shares an IP; a guessable code would need far more tries than this.
  start_passkey_registration: { limit: 30, windowSeconds: 3600 },
};

/** `a, b,` → `['a', 'b']`. */
const commaList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== ''),
  );

export const ApiConfigSchema: z.ZodType<ApiConfig> = z
  .object({
    storage: z.enum(['postgres', 'memory']).default('postgres'),
    databaseUrl: z.url({ protocol: /^postgres(ql)?$/ }).exactOptional(),
    deviceTokenSecret: z.string().min(32),
    host: z.string().min(1).default('127.0.0.1'),
    port: z.coerce.number().int().min(0).max(65_535).default(3000),
    logLevel: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    trustProxy: z.stringbool().default(false),
    webRoot: z.string().min(1).exactOptional(),
    corsOrigins: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin !== ''),
      )
      .pipe(
        z.array(
          z
            .string()
            .refine(
              (origin) =>
                !origin.includes('*') &&
                URL.canParse(origin) &&
                /^https?:$/.test(new URL(origin).protocol) &&
                new URL(origin).origin === origin,
              'CORS_ORIGINS takes exact origins: http(s)://host[:port], no path, no wildcard',
            ),
        ),
      ),
    rateLimits: z.record(z.string(), RateLimitRuleSchema).default(DEFAULT_RATE_LIMITS),
    attestation: z
      .object({
        trustUnattested: z.stringbool().default(false),
        appAttestAppIds: commaList,
        appAttestDevelopment: z.stringbool().default(false),
        turnstileSecretKey: z.string().min(1).exactOptional(),
        turnstileHostnames: commaList,
      })
      .prefault({}),
    access: z
      .object({
        teamDomain: z.url({ protocol: /^https$/ }).transform((url) => new URL(url).origin),
        audience: z.string().min(1),
      })
      .exactOptional(),
    passkeys: z
      .object({
        origin: z.url({ protocol: /^https?$/ }).refine((url) => new URL(url).origin === url, {
          message: 'PASSKEY_ORIGIN takes an exact origin: https://host, no path',
        }),
        inviteCode: z.string().trim().min(8).exactOptional(),
      })
      .exactOptional(),
    imports: z
      .object({
        overpassUrl: z.url({ protocol: /^https?$/ }).default(DEFAULT_IMPORTS.overpassUrl),
        overpassAreaId: z.coerce.number().int().positive().default(DEFAULT_IMPORTS.overpassAreaId),
        cacheDir: z.string().min(1).default(DEFAULT_IMPORTS.cacheDir),
        cacheMaxAgeHours: z.coerce.number().nonnegative().default(DEFAULT_IMPORTS.cacheMaxAgeHours),
        curatedClaimsPath: z.string().min(1).default(DEFAULT_IMPORTS.curatedClaimsPath),
        statementPath: z.string().min(1).default(DEFAULT_IMPORTS.statementPath),
      })
      .default(DEFAULT_IMPORTS),
  })
  .refine((config) => config.storage === 'memory' || config.databaseUrl !== undefined, {
    message: 'DATABASE_URL is required when STORAGE is postgres',
    path: ['databaseUrl'],
  })
  .refine((config) => config.access === undefined || config.passkeys === undefined, {
    message: 'Use either Cloudflare Access (ACCESS_*) or passkeys (PASSKEY_*), not both',
    path: ['passkeys'],
  });

interface Storage {
  readonly places: PlaceReader & PlaceWriter;
  readonly chains: ChainReader;
  readonly evidence: EvidenceReader;
  readonly statuses: PlaceStatusReader;
  readonly devices: DeviceReader & DeviceWriter;
  readonly passkeys: PasskeyReader & PasskeyWriter;
  readonly households: HouseholdReader & HouseholdWriter;
  readonly importRuns: ImportRunReader & ImportRunWriter;
  readonly unmatchedDescriptors: UnmatchedDescriptorWriter;
  readonly unitOfWork: UnitOfWork;
  close(): Promise<void>;
}

/**
 * The only place in the API allowed to construct application and infrastructure classes.
 * Everything is wired once in the constructor.
 */
export class CompositionRoot {
  public readonly httpServer: HttpServer;
  public readonly runImport: RunImport;
  public readonly seedImports: SeedImports;
  public readonly refreshStaleStatuses: RefreshStaleStatuses;
  private readonly db: Kysely<Database> | null;
  private readonly storage: Storage;

  public constructor(private readonly config: ApiConfig) {
    const clock = new SystemClock();
    const ids = new UuidV7IdGenerator(clock);
    const names = new TrigramNameSimilarity();
    const validator = new ZodInputValidator();
    const selector = new SupersedingEvidenceSelector();
    const calculator = new DecayingAcceptanceStatusCalculator(
      new FixedEvidenceWeightPolicy(),
      {},
      selector,
    );
    const rateLimiter = new InMemoryRateLimiter(config.rateLimits, clock);
    const tokens = new HmacDeviceTokenService(config.deviceTokenSecret, clock);
    const refresher = new CalculatingPlaceStatusRefresher(
      calculator,
      new ProportionChainHintCalculator(),
      clock,
    );

    this.db =
      config.storage === 'postgres'
        ? new Kysely<Database>({
            dialect: new PostgresDialect({
              pool: new pg.Pool({ connectionString: config.databaseUrl }),
            }),
          })
        : null;
    this.storage =
      this.db === null ? this.inMemoryStorage(names, clock) : this.postgresStorage(this.db, names);
    const {
      places,
      chains,
      evidence,
      statuses,
      devices,
      passkeys,
      households,
      importRuns,
      unmatchedDescriptors,
      unitOfWork,
    } = this.storage;

    const auth = new BearerTokenAuthenticator(tokens);
    const challenges = new HmacAttestationChallengeService(
      { secret: config.deviceTokenSecret, ttlSeconds: 300 },
      clock,
    );
    const dtos = new AllowlistHttpDtoMapper();
    const joinTokens = new Sha256JoinTokenHasher();
    const placeMatcher = new TrigramGeoPlaceMatcher(places, names, {
      radiusM: 300,
      searchLimit: 20,
      minimumScore: 0.25,
    });
    const sessions = new HmacAccessSessionService(config.deviceTokenSecret, clock);
    const passkeyChallenges = new HmacPasskeyChallengeService(config.deviceTokenSecret, clock);
    const accessControllers =
      config.passkeys === undefined
        ? []
        : [
            this.accessController(
              config.passkeys,
              passkeys,
              sessions,
              passkeyChallenges,
              rateLimiter,
              validator,
              clock,
            ),
          ];
    this.httpServer = new FastifyHttpServer(
      [
        ...accessControllers,
        new PlacesController(
          new SearchPlacesUseCase(places, statuses, validator),
          new ListNearbyPlacesUseCase(places, statuses, validator),
          new ListPlacesInAreaUseCase(places, statuses, validator),
          new GetPlaceDetailsUseCase(
            places,
            chains,
            evidence,
            calculator,
            new LatestEvidenceSummarizer(selector),
            clock,
          ),
          new CreatePlaceUseCase(
            places,
            places,
            new NameDistancePlaceDuplicateMatcher(names),
            ids,
            clock,
            rateLimiter,
            validator,
            { duplicateRadiusM: 150, duplicateCandidates: 20 },
          ),
          auth,
          validator,
          dtos,
          { searchLimit: 20, nearbyLimit: 50, areaLimit: 400, defaultRadiusM: 1000 },
        ),
        new ReportsController(
          new SubmitReportUseCase(
            unitOfWork,
            refresher,
            devices,
            new AttestationReportEvidencePolicy({
              trustUnattested: config.attestation.trustUnattested,
            }),
            ids,
            clock,
            rateLimiter,
            validator,
          ),
          new RemoveMyReportUseCase(unitOfWork, refresher, selector, ids, clock, rateLimiter),
          auth,
          validator,
          dtos,
        ),
        new HealthController(),
        new CardsController(new ListCardsUseCase(new InMemoryCardReader(CARD_CATALOGUE))),
        ...(config.webRoot === undefined
          ? []
          : [new StaticWebController({ root: config.webRoot })]),
        new DevicesController(
          new RegisterDeviceUseCase(devices, tokens, ids, clock, rateLimiter),
          new IssueAttestationChallengeUseCase(challenges),
          new AttestDeviceUseCase(
            devices,
            challenges,
            this.appAttestValidator(config.attestation, clock),
            this.turnstileValidator(config.attestation),
            clock,
            rateLimiter,
          ),
          auth,
          validator,
        ),
        new HouseholdsController(
          new CreateHouseholdUseCase(households, households, joinTokens, ids, clock, rateLimiter),
          new JoinHouseholdUseCase(households, households, joinTokens, clock, rateLimiter),
          new LeaveHouseholdUseCase(households, households, clock),
          new GetMyHouseholdUseCase(households),
          new AppendHouseholdRecordsUseCase(households, households, clock, rateLimiter),
          new ListHouseholdRecordsUseCase(households),
          auth,
          validator,
        ),
        new SharedMatchController(
          new MatchSharedPlaceUseCase(
            new RegexSharedTextParser(),
            new NullSharedLinkResolver(),
            placeMatcher,
            new ThresholdMatchDecider({ openThreshold: 0.6, minimumLead: 0.15 }),
            statuses,
          ),
          // A clear payment match is saved as an answer without asking, so it needs more.
          new MatchPaymentUseCase(
            new RegexMerchantNameParser(),
            placeMatcher,
            new ThresholdMatchDecider({ openThreshold: 0.7, minimumLead: 0.2 }),
            statuses,
            validator,
          ),
          validator,
          dtos,
        ),
      ],
      new DomainHttpErrorMapper(),
      pino({
        level: config.logLevel,
        // Paths only: query strings hold searches and positions, which stay out of the logs.
        serializers: {
          req: (request: { method: string; url: string }) => ({
            method: request.method,
            url: request.url.split('?')[0],
          }),
        },
      }),
      this.accessAuthenticator(sessions, passkeys),
      { bodyLimit: 16 * 1024, trustProxy: config.trustProxy, corsOrigins: config.corsOrigins },
    );

    const importUnitOfWork = new TransactionalImportUnitOfWork(unitOfWork);
    const cache = { maxAgeMs: config.imports.cacheMaxAgeHours * 3_600_000 };
    this.refreshStaleStatuses = new RefreshStaleStatusesUseCase(
      unitOfWork,
      refresher,
      clock,
      validator,
    );
    this.runImport = new RunImportUseCase(
      [
        new OverpassOsmImporter(
          new DiskCachingOverpassClient(
            new HttpOverpassClient(
              {
                endpoint: config.imports.overpassUrl,
                userAgent: IMPORT_USER_AGENT,
                timeoutMs: 300_000,
              },
              globalThis.fetch,
              clock,
            ),
            { ...cache, directory: join(config.imports.cacheDir, 'overpass') },
            clock,
          ),
          new TagOsmElementTranslator(),
          new GridOsmAddressLocator(0.0005),
          importUnitOfWork,
          refresher,
          ids,
          clock,
          {
            areaId: config.imports.overpassAreaId,
            timeoutSeconds: 240,
            maxMessages: 50,
            addressMaxDistanceM: 25,
          },
        ),
        new CuratedListImporter(
          new FsTextFileLoader(),
          importUnitOfWork,
          refresher,
          names,
          ids,
          clock,
          { path: config.imports.curatedClaimsPath, maxMessages: 50 },
        ),
        new BrregUnderenhetImporter(
          new CachedBrregUnderenhetReader(
            {
              url: 'https://data.brreg.no/enhetsregisteret/api/underenheter/lastned/csv',
              cacheFile: join(config.imports.cacheDir, 'brreg', 'underenheter.csv.gz'),
              maxAgeMs: cache.maxAgeMs,
              userAgent: IMPORT_USER_AGENT,
            },
            globalThis.fetch,
            clock,
          ),
          new AddressBrregPlaceMatcher(names, { minimumScore: 0.3, minimumLead: 0.05 }),
          importUnitOfWork,
          clock,
          { kommunenummer: OSLO_KOMMUNENUMMER, maxMessages: 50 },
        ),
        new StatementImporter(
          new FsTextFileLoader(),
          new UnconfiguredStatementParser(),
          new NullMerchantDescriptorMatcher(),
          unmatchedDescriptors,
          clock,
          { path: config.imports.statementPath },
        ),
      ],
      importRuns,
      ids,
      clock,
    );
    this.seedImports = new SeedImportsUseCase(importRuns, this.runImport);
  }

  private appAttestValidator(config: AttestationConfig, clock: SystemClock): AppAttestValidator {
    return config.appAttestAppIds.length === 0
      ? new UnconfiguredAppAttestValidator()
      : new AppleAppAttestValidator(
          {
            appIds: config.appAttestAppIds,
            rootCertificatePem: APPLE_APP_ATTESTATION_ROOT_CA_PEM,
            environments: config.appAttestDevelopment
              ? ['production', 'development']
              : ['production'],
          },
          clock,
        );
  }

  private turnstileValidator(config: AttestationConfig): TurnstileValidator {
    return config.turnstileSecretKey === undefined
      ? new UnconfiguredTurnstileValidator()
      : new HttpTurnstileValidator(
          {
            secretKey: config.turnstileSecretKey,
            hostnames: config.turnstileHostnames,
            siteverifyUrl: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          },
          (url, init) => fetch(url, init),
        );
  }

  /**
   * Drops unset and empty variables, so optional settings are absent rather than `undefined`
   * (which `exactOptional` refuses) and defaults apply to empty ones.
   */
  private static withoutUnset<T extends Record<string, unknown>>(values: T): T {
    return Object.fromEntries(
      Object.entries(values)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [
          key,
          typeof value === 'object' && value !== null
            ? CompositionRoot.withoutUnset(value as Record<string, unknown>)
            : value,
        ]),
    ) as T;
  }

  /** Reads config from the environment. @throws ZodError when it is incomplete. */
  public static fromEnv(env: NodeJS.ProcessEnv): CompositionRoot {
    return new CompositionRoot(
      ApiConfigSchema.parse(
        CompositionRoot.withoutUnset({
          storage: env.STORAGE,
          databaseUrl: env.DATABASE_URL,
          deviceTokenSecret: env.DEVICE_TOKEN_SECRET,
          host: env.HOST,
          port: env.PORT,
          logLevel: env.LOG_LEVEL,
          trustProxy: env.TRUST_PROXY,
          webRoot: env.WEB_ROOT,
          corsOrigins: env.CORS_ORIGINS,
          ...(env.ACCESS_TEAM_DOMAIN === undefined && env.ACCESS_AUD === undefined
            ? {}
            : { access: { teamDomain: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_AUD } }),
          ...(env.PASSKEY_ORIGIN === undefined && env.PASSKEY_INVITE_CODE === undefined
            ? {}
            : { passkeys: { origin: env.PASSKEY_ORIGIN, inviteCode: env.PASSKEY_INVITE_CODE } }),
          attestation: {
            trustUnattested: env.TRUST_UNATTESTED_DEVICES,
            appAttestAppIds: env.APP_ATTEST_APP_IDS,
            appAttestDevelopment: env.APP_ATTEST_DEVELOPMENT,
            turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
            turnstileHostnames: env.TURNSTILE_HOSTNAMES,
          },
          imports: {
            overpassUrl: env.OVERPASS_URL,
            overpassAreaId: env.OVERPASS_AREA_ID,
            cacheDir: env.IMPORT_CACHE_DIR,
            cacheMaxAgeHours: env.IMPORT_CACHE_MAX_AGE_HOURS,
            curatedClaimsPath: env.CURATED_CLAIMS_PATH,
            statementPath: env.STATEMENT_PATH,
          },
        }),
      ),
    );
  }

  /** @throws Error when storage is not postgres. */
  public migrator(): Migrator {
    if (this.db === null) {
      throw new Error('Migrations need STORAGE=postgres.');
    }
    return new Migrator({ db: this.db, provider: new AllMigrationsProvider() });
  }

  public async start(): Promise<string> {
    return this.httpServer.listen(this.config.host, this.config.port);
  }

  public async close(): Promise<void> {
    await this.httpServer.close();
    await this.storage.close();
  }

  private accessAuthenticator(
    sessions: HmacAccessSessionService,
    passkeys: PasskeyReader,
  ): AccessAuthenticator {
    if (this.config.passkeys !== undefined) {
      return new SessionCookieAccessAuthenticator(sessions, passkeys);
    }
    if (this.config.access !== undefined) {
      return new JwksAccessAuthenticator(
        createRemoteJWKSet(new URL('/cdn-cgi/access/certs', this.config.access.teamDomain)),
        { issuer: this.config.access.teamDomain, audience: this.config.access.audience },
      );
    }
    return new NullAccessAuthenticator();
  }

  private accessController(
    config: PasskeysConfig,
    passkeys: PasskeyReader & PasskeyWriter,
    sessions: HmacAccessSessionService,
    challenges: HmacPasskeyChallengeService,
    rateLimiter: InMemoryRateLimiter,
    validator: ZodInputValidator,
    clock: SystemClock,
  ): AccessController {
    const ceremony = new WebAuthnPasskeyService({
      origin: config.origin,
      rpName: 'Tar de Amex?',
    });
    return new AccessController(
      new StartPasskeyRegistrationUseCase(
        new FixedPasskeyInviteValidator(config.inviteCode ?? null),
        challenges,
        ceremony,
        rateLimiter,
      ),
      new CompletePasskeyRegistrationUseCase(challenges, ceremony, passkeys, sessions, clock),
      new StartPasskeySignInUseCase(challenges, ceremony),
      new CompletePasskeySignInUseCase(challenges, ceremony, passkeys, passkeys, sessions),
      new RenewAccessSessionUseCase(sessions, passkeys),
      validator,
    );
  }

  private postgresStorage(db: Kysely<Database>, names: TrigramNameSimilarity): Storage {
    const errors = new PgDatabaseErrorTranslator();
    const portsFor = (executor: Kysely<Database>): TransactionalPorts => ({
      places: new PgPlaceRepository(executor, names, errors),
      chains: new PgChainRepository(executor, errors),
      evidence: new PgEvidenceRepository(executor, errors),
      statuses: new PgPlaceStatusRepository(executor, errors),
    });
    return {
      ...portsFor(db),
      devices: new PgDeviceRepository(db, errors),
      passkeys: new PgPasskeyRepository(db, errors),
      households: new PgHouseholdRepository(db, errors),
      importRuns: new PgImportRunRepository(db, errors),
      unmatchedDescriptors: new PgUnmatchedDescriptorRepository(db),
      unitOfWork: new PgUnitOfWork(db, portsFor, errors),
      close: () => db.destroy(),
    };
  }

  private inMemoryStorage(names: TrigramNameSimilarity, clock: SystemClock): Storage {
    const tables = new EmptyInMemoryTablesFactory().create();
    const portsFor = (state: InMemoryTables): TransactionalPorts => ({
      places: new InMemoryPlaceRepository(state, names, clock),
      chains: new InMemoryChainRepository(state, names, clock),
      evidence: new InMemoryEvidenceRepository(state),
      statuses: new InMemoryPlaceStatusRepository(state),
    });
    return {
      ...portsFor(tables),
      devices: new InMemoryDeviceRepository(tables),
      passkeys: new InMemoryPasskeyRepository(),
      households: new InMemoryHouseholdRepository(tables),
      importRuns: new InMemoryImportRunRepository(tables),
      unmatchedDescriptors: new InMemoryUnmatchedDescriptorRepository(tables),
      unitOfWork: new InMemoryUnitOfWork(tables, portsFor),
      close: () => Promise.resolve(),
    };
  }
}
