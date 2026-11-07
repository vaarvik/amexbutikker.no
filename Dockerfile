# The API as a container: the API and the workspace packages it uses, nothing from the app.
# Build:  docker build -t amexbutikker-api .
# Run:    docker run -p 3000:3000 --env-file .env amexbutikker-api
# The same image runs migrations (node dist/src/migrate.js) and the nightly
# status refresh (node dist/src/cli.js refresh-statuses). See docs/hosting.md.

FROM node:24-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
# Only the API and its workspace dependencies (plus the root tools: TypeScript).
RUN pnpm install --frozen-lockfile --filter "@amexbutikker/api..."
RUN pnpm exec tsc -b apps/api
# A self-contained folder with production dependencies only.
RUN pnpm --filter @amexbutikker/api deploy --prod --legacy /out

FROM node:24-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 STORAGE=postgres
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/src/server.js"]
