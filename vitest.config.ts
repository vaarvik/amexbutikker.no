import { defineConfig } from 'vitest/config';

const sourceCondition = '@amexbutikker/source';
// TEST_SCOPE=unit (`pnpm test:unit`) skips the Docker-backed integration tests.
// TEST_SCOPE=perf (`pnpm test:perf`) runs only the performance checks, which are otherwise skipped.
const scope = process.env.TEST_SCOPE;
const include =
  scope === 'perf' ? ['test/**/*.perf.test.ts'] : ['{src,test,test-kit}/**/*.test.ts'];
const scopeExclude =
  scope === 'perf'
    ? []
    : scope === 'unit'
      ? ['**/*.integration.test.ts', '**/*.perf.test.ts']
      : ['**/*.perf.test.ts'];

export default defineConfig({
  resolve: { conditions: [sourceCondition, 'module', 'node', 'development|production'] },
  ssr: { resolve: { conditions: [sourceCondition, 'node', 'development|production'] } },
  test: {
    passWithNoTests: true,
    env: {
      // Testcontainers mounts the Docker socket into its cleanup container. The path must be the
      // one inside the Docker VM (Colima, Docker Desktop) or host (Linux), which is this for all of them.
      TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE:
        process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE ?? '/var/run/docker.sock',
    },
    coverage: {
      provider: 'v8',
      include: [
        'packages/domain/src/**',
        'packages/application/src/**',
        'packages/in-memory/src/**',
        'apps/api/src/**',
        'apps/mobile/src/**',
      ],
      // Wiring and entry points: exercised by the API tests, not worth a floor of their own.
      exclude: [
        '**/index.ts',
        '**/composition-root.ts',
        '**/server.ts',
        '**/migrate.ts',
        '**/cli.ts',
        // Screens and components: React views, checked by hand on a device (see CLAUDE.md, UI exception).
        'apps/mobile/src/app/**',
        'apps/mobile/src/ui/**',
      ],
      thresholds: {
        'packages/domain/src/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'packages/application/src/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'packages/in-memory/src/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'apps/api/src/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'apps/mobile/src/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
      },
    },
    projects: [
      'packages/contracts',
      'packages/domain',
      'packages/in-memory',
      'packages/application',
      'apps/api',
      'apps/mobile',
      'tools/contract-check',
    ].map((root) => ({
      extends: true,
      test: {
        name: root.split('/').at(-1) ?? root,
        root,
        include,
        exclude: ['**/node_modules/**', '**/dist/**', 'test/fixtures/**', ...scopeExclude],
      },
    })),
  },
});
