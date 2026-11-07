import { stat } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import type { HttpController } from './shared.ports.js';

export interface StaticWebControllerConfig {
  /** The web app's static export (`expo export --platform web`, i.e. apps/mobile/dist). */
  readonly root: string;
}

/**
 * Serves the web app from the API's own origin, so `amex.johann.no` is one container: the app
 * at `/`, the API at `/v1`. expo-router's static export has one HTML file per route; a dynamic
 * route keeps its bracket name (`/place/<id>` is `place/[id].html`). Unknown paths get the app's
 * own not-found page; unknown `/v1` paths keep the API's JSON 404.
 */
export class StaticWebController implements HttpController {
  public constructor(private readonly config: StaticWebControllerConfig) {}

  public register(app: FastifyInstance): void {
    void app.register(fastifyStatic, { root: this.config.root, serve: false });

    app.get('/*', async (request, reply) => {
      const path = decodeURIComponent(request.url.split('?')[0] ?? '/');
      if (path.startsWith('/v1/') || path === '/v1') {
        return reply.status(404).send({
          error: { code: 'not_found', message: `No route for GET ${path}.` },
        });
      }
      const file = await this.resolve(path);
      if (file === null) {
        return reply.status(404).sendFile('+not-found.html', { cacheControl: false });
      }
      // Bundles under _expo/static have content hashes in their names; pages must stay fresh.
      const immutable = file.startsWith('_expo/');
      return reply
        .header('cache-control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache')
        .sendFile(file, { cacheControl: false });
    });
  }

  /** The file to send for a path, relative to the root, or null when there is none. */
  private async resolve(path: string): Promise<string | null> {
    const clean = normalize(path).replace(/^[/\\]+/, '');
    if (clean.split(sep).includes('..')) {
      return null;
    }
    const candidates = [
      clean,
      `${clean}.html`,
      join(clean, 'index.html'),
      ...(/^place\/[^/]+$/.test(clean) ? ['place/[id].html'] : []),
    ];
    for (const candidate of candidates) {
      if (await this.isFile(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private async isFile(relative: string): Promise<boolean> {
    try {
      return (await stat(join(this.config.root, relative))).isFile();
    } catch {
      return false;
    }
  }
}
