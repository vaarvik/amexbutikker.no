// Metro config for the pnpm workspace.
// Workspace packages export their TypeScript source under the `@amexbutikker/source` condition
// and import siblings as `./x.js` (NodeNext style). Metro resolves that condition and, inside
// workspace packages, maps a missing `./x.js` to `./x.ts`.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const packagesDir = path.resolve(__dirname, '../../packages');

config.resolver.unstable_conditionNames = [
  '@amexbutikker/source',
  ...(config.resolver.unstable_conditionNames ?? ['require', 'default']),
];

const resolveDefault = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = resolveDefault ?? context.resolveRequest;
  if (
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js') &&
    context.originModulePath.startsWith(packagesDir)
  ) {
    try {
      return resolve(context, moduleName.replace(/\.js$/, '.ts'), platform);
    } catch {
      // Not a TypeScript sibling: fall through to the normal resolution.
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
