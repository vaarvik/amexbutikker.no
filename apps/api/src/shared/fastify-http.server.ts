import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type {
  AccessAuthenticator,
  HttpController,
  HttpErrorMapper,
  HttpServer,
} from './shared.ports.js';

export interface FastifyHttpServerConfig {
  /** Max request body size in bytes. */
  readonly bodyLimit: number;
  /** Trust X-Forwarded-* from a proxy or tunnel in front of the API. */
  readonly trustProxy: boolean;
  /** Exact browser origins allowed by CORS; empty sends no CORS headers at all. */
  readonly corsOrigins: readonly string[];
}

/** Open without a login, so the host can check that the app runs. */
const OPEN_PATHS: ReadonlySet<string> = new Set(['/health']);

export class FastifyHttpServer implements HttpServer {
  private instance: FastifyInstance | undefined;

  public constructor(
    private readonly controllers: readonly HttpController[],
    private readonly errors: HttpErrorMapper,
    private readonly logger: FastifyBaseLogger,
    private readonly access: AccessAuthenticator,
    private readonly options: FastifyHttpServerConfig,
  ) {}

  public app(): FastifyInstance {
    this.instance ??= this.build();
    return this.instance;
  }

  public listen(host: string, port: number): Promise<string> {
    return this.app().listen({ host, port });
  }

  public async close(): Promise<void> {
    await this.instance?.close();
  }

  private build(): FastifyInstance {
    const app = Fastify({
      loggerInstance: this.logger,
      bodyLimit: this.options.bodyLimit,
      trustProxy: this.options.trustProxy,
    });
    app.setErrorHandler((error, request, reply) => {
      const response = this.errors.toResponse(error);
      if (response.unexpected) {
        request.log.error({ err: error }, 'Unhandled error');
      }
      return reply.status(response.statusCode).headers(response.headers).send(response.body);
    });
    app.addHook('onRequest', async (request) => {
      if (!OPEN_PATHS.has(request.url.split('?')[0] ?? '')) {
        await this.access.requireAccess(request);
      }
    });
    app.setNotFoundHandler((request, reply) =>
      reply.status(404).send({
        error: { code: 'not_found', message: `No route for ${request.method} ${request.url}.` },
      }),
    );
    if (this.options.corsOrigins.length > 0) {
      void app.register(cors, {
        origin: [...this.options.corsOrigins],
        methods: ['GET', 'POST', 'DELETE'],
        allowedHeaders: ['accept', 'content-type', 'authorization'],
        maxAge: 600,
      });
    }
    for (const controller of this.controllers) {
      controller.register(app);
    }
    return app;
  }
}
