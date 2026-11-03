import { Kysely, PostgresDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import pg from 'pg';
import { z } from 'zod';
import { AllMigrationsProvider } from './migrations/all-migrations-provider.js';
import type { Database } from './shared/postgres/database.js';

export interface ApiConfig {
  readonly databaseUrl: string;
}

export const ApiConfigSchema: z.ZodType<ApiConfig> = z.object({
  databaseUrl: z.url({ protocol: /^postgres(ql)?$/ }),
});

/**
 * The only place in the API allowed to construct application and infrastructure classes.
 * Use cases and the HTTP adapter are wired here in phase 4.
 */
export class CompositionRoot {
  private readonly db: Kysely<Database>;

  public constructor(config: ApiConfig) {
    this.db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: config.databaseUrl }) }),
    });
  }

  /** Reads config from the environment. @throws ZodError when it is incomplete. */
  public static fromEnv(env: NodeJS.ProcessEnv): CompositionRoot {
    return new CompositionRoot(ApiConfigSchema.parse({ databaseUrl: env.DATABASE_URL }));
  }

  public migrator(): Migrator {
    return new Migrator({ db: this.db, provider: new AllMigrationsProvider() });
  }

  public async start(): Promise<void> {
    // Nothing to start yet: the HTTP adapter arrives in phase 4.
  }

  public async close(): Promise<void> {
    await this.db.destroy();
  }
}
