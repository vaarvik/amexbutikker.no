import { defineConfig } from 'vitest/config';

const sourceCondition = '@amexbutikker/source';

export default defineConfig({
  resolve: { conditions: [sourceCondition, 'module', 'node', 'development|production'] },
  ssr: { resolve: { conditions: [sourceCondition, 'node', 'development|production'] } },
  test: {
    passWithNoTests: true,
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
