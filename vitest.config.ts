import { defineConfig } from 'vitest/config';

const sourceCondition = '@amexbutikker/source';

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
    projects: [
      'packages/contracts',
      'packages/domain',
      'packages/application',
      'apps/api',
      'tools/contract-check',
    ].map((root) => ({
      extends: true,
      test: {
        name: root.split('/').at(-1) ?? root,
        root,
        include: ['{src,test,test-kit}/**/*.test.ts'],
        exclude: ['**/node_modules/**', '**/dist/**', 'test/fixtures/**'],
      },
    })),
  },
});
