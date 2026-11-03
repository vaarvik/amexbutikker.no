import {
  CalculatingPlaceStatusRefresher,
  CreatePlaceUseCase,
  FindNearbyPlacesUseCase,
  GetPlaceDetailsUseCase,
  RegisterDeviceUseCase,
  RemoveMyReportUseCase,
  SearchPlacesUseCase,
  SubmitReportUseCase,
  ZodInputValidator,
} from '@amexbutikker/application';
import type {
  ChainReader,
  DeviceWriter,
  EvidenceReader,
  PlaceReader,
  PlaceStatusReader,
  PlaceWriter,
  TransactionalPorts,
  UnitOfWork,
} from '@amexbutikker/contracts';
import {
  DecayingAcceptanceStatusCalculator,
  DefaultEvidenceWeightPolicy,
  LatestEvidenceSummarizer,
  ProportionChainHintCalculator,
  SupersedingEvidenceSelector,
  TrigramNameSimilarity,
} from '@amexbutikker/domain';
import { Kysely, PostgresDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import pg from 'pg';
import { pino } from 'pino';
import { z } from 'zod';
import { InMemoryChainRepository } from './chains/in-memory/in-memory-chain-repository.js';
import { PgChainRepository } from './chains/postgres/pg-chain-repository.js';
import { DevicesController } from './devices/http/devices-controller.js';
import { InMemoryDeviceRepository } from './devices/in-memory/in-memory-device-repository.js';
import { HmacDeviceTokenService } from './devices/infrastructure/hmac-device-token-service.js';
import { PgDeviceRepository } from './devices/postgres/pg-device-repository.js';
import { InMemoryEvidenceRepository } from './evidence/in-memory/in-memory-evidence-repository.js';
import { PgEvidenceRepository } from './evidence/postgres/pg-evidence-repository.js';
import { AllMigrationsProvider } from './migrations/all-migrations-provider.js';
import { PlacesController } from './places/http/places-controller.js';
import { InMemoryPlaceRepository } from './places/in-memory/in-memory-place-repository.js';
import { PgPlaceRepository } from './places/postgres/pg-place-repository.js';
import { ReportsController } from './reports/http/reports-controller.js';
import { FastifyHttpServer } from './shared/http/fastify-http-server.js';
import type { HttpServer } from './shared/http/fastify-http-server.js';
import { DomainHttpErrorMapper } from './shared/http/http-error-mapper.js';
import { DefaultHttpDtoMapper } from './shared/http/http-dto-mapper.js';
import { BearerTokenAuthenticator } from './shared/http/request-authenticator.js';
import { InMemoryRateLimiter } from './shared/in-memory/in-memory-rate-limiter.js';
import { EmptyInMemoryTablesFactory } from './shared/in-memory/in-memory-tables.js';
import type { InMemoryTables } from './shared/in-memory/in-memory-tables.js';
import { InMemoryUnitOfWork } from './shared/in-memory/in-memory-unit-of-work.js';
import { SystemClock } from './shared/infrastructure/system-clock.js';
import { UuidV7IdGenerator } from './shared/infrastructure/uuid-v7-id-generator.js';
import type { Database } from './shared/postgres/database.js';
import { PgDatabaseErrorTranslator } from './shared/postgres/database-error-translator.js';
import { PgUnitOfWork } from './shared/postgres/pg-unit-of-work.js';
import { InMemoryPlaceStatusRepository } from './status/in-memory/in-memory-place-status-repository.js';
import { PgPlaceStatusRepository } from './status/postgres/pg-place-status-repository.js';

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
  readonly rateLimits: Readonly<Record<string, z.infer<typeof RateLimitRuleSchema>>>;
}

export const DEFAULT_RATE_LIMITS: ApiConfig['rateLimits'] = {
  submit_report: { limit: 30, windowSeconds: 3600 },
  create_place: { limit: 10, windowSeconds: 3600 },
  register_device: { limit: 20, windowSeconds: 3600 },
};

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
    rateLimits: z.record(z.string(), RateLimitRuleSchema).default(DEFAULT_RATE_LIMITS),
  })
  .refine((config) => config.storage === 'memory' || config.databaseUrl !== undefined, {
    message: 'DATABASE_URL is required when STORAGE is postgres',
    path: ['databaseUrl'],
  });

interface Storage {
  readonly places: PlaceReader & PlaceWriter;
  readonly chains: ChainReader;
  readonly evidence: EvidenceReader;
  readonly statuses: PlaceStatusReader;
  readonly devices: DeviceWriter;
  readonly unitOfWork: UnitOfWork;
  close(): Promise<void>;
}

/**
 * The only place in the API allowed to construct application and infrastructure classes.
 * Everything is wired once in the constructor.
 */
export class CompositionRoot {
  public readonly httpServer: HttpServer;
  private readonly db: Kysely<Database> | null;
  private readonly storage: Storage;

  public constructor(private readonly config: ApiConfig) {
    const clock = new SystemClock();
    const ids = new UuidV7IdGenerator(clock);
    const names = new TrigramNameSimilarity();
    const validator = new ZodInputValidator();
    const selector = new SupersedingEvidenceSelector();
    const calculator = new DecayingAcceptanceStatusCalculator(
      new DefaultEvidenceWeightPolicy(),
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
    const { places, chains, evidence, statuses, devices, unitOfWork } = this.storage;

    const auth = new BearerTokenAuthenticator(tokens);
    const dtos = new DefaultHttpDtoMapper();
    this.httpServer = new FastifyHttpServer(
      [
        new PlacesController(
          new SearchPlacesUseCase(places, statuses, validator),
          new FindNearbyPlacesUseCase(places, statuses, validator),
          new GetPlaceDetailsUseCase(
            places,
            chains,
            evidence,
            calculator,
            new LatestEvidenceSummarizer(selector),
            clock,
          ),
          new CreatePlaceUseCase(places, ids, clock, rateLimiter, validator),
          auth,
          validator,
          dtos,
          { searchLimit: 20, nearbyLimit: 50, defaultRadiusM: 1000 },
        ),
        new ReportsController(
          new SubmitReportUseCase(unitOfWork, refresher, ids, clock, rateLimiter, validator),
          new RemoveMyReportUseCase(unitOfWork, refresher, selector, ids, clock, rateLimiter),
          auth,
          validator,
          dtos,
        ),
        new DevicesController(
          new RegisterDeviceUseCase(devices, tokens, ids, clock, rateLimiter),
          validator,
        ),
        // SharedMatchController is registered in phase 7, with the real parser and matcher.
      ],
      new DomainHttpErrorMapper(),
      pino({ level: config.logLevel }),
      { bodyLimit: 16 * 1024, trustProxy: config.trustProxy },
    );
  }

  /** Reads config from the environment. @throws ZodError when it is incomplete. */
  public static fromEnv(env: NodeJS.ProcessEnv): CompositionRoot {
    return new CompositionRoot(
      ApiConfigSchema.parse({
        storage: env.STORAGE,
        databaseUrl: env.DATABASE_URL,
        deviceTokenSecret: env.DEVICE_TOKEN_SECRET,
        host: env.HOST,
        port: env.PORT,
        logLevel: env.LOG_LEVEL,
        trustProxy: env.TRUST_PROXY,
      }),
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
      unitOfWork: new InMemoryUnitOfWork(tables, portsFor),
      close: () => Promise.resolve(),
    };
  }
}
