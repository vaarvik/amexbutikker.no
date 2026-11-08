# syntax=docker/dockerfile:1
# The API and the web app in one container: the web app at /, the API at /v1, one origin.
# Build:  docker build -t amexbutikker .
# Run:    docker run -p 3000:3000 --env-file .env amexbutikker
# The same image runs migrations (node dist/src/migrate.js) and the nightly status refresh
# (node dist/src/cli.js refresh-statuses). See docs/hosting.md.
#
# Both build stages run on the build machine's own architecture: their output is JavaScript and
# static files, so a multi-arch build (amd64 + arm64) needs no emulation.

FROM --platform=$BUILDPLATFORM node:24-slim AS api
RUN corepack enable
WORKDIR /repo
COPY . .
# Only the API and its workspace dependencies (plus the root tools: TypeScript).
RUN pnpm install --frozen-lockfile --filter "@amexbutikker/api..."
RUN pnpm exec tsc -b apps/api
# A self-contained folder with production dependencies only.
RUN pnpm --filter @amexbutikker/api deploy --prod --legacy /out

FROM --platform=$BUILDPLATFORM node:24-slim AS web
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@amexbutikker/mobile..."
# Static rendering bundles for Node, which resolves the workspace packages to their compiled dist.
RUN pnpm exec tsc -b packages/contracts
# The Turnstile widget's public site key (Phase 16); empty builds the web app without Turnstile.
ARG EXPO_PUBLIC_TURNSTILE_SITE_KEY=""
# "/" makes the web app call the API on its own origin.
RUN cd apps/mobile && EXPO_PUBLIC_API_URL=/ EXPO_PUBLIC_TURNSTILE_SITE_KEY="$EXPO_PUBLIC_TURNSTILE_SITE_KEY" \
    pnpm exec expo export --platform web --output-dir /web

FROM node:24-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 STORAGE=postgres WEB_ROOT=/app/web
WORKDIR /app
COPY --from=api --chown=node:node /out .
COPY --from=web --chown=node:node /web ./web
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/src/server.js"]
