import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Static settings live in app.json; this adds what comes from the environment, so ids can change
 * without editing code:
 * - APP_IOS_BUNDLE_ID / APP_ANDROID_PACKAGE: the app's identity on each platform;
 * - EAS_PROJECT_ID: overrides the EAS project in app.json (`@vaarvik/amexbutikker`).
 *
 * `runtimeVersion` uses the fingerprint policy: EAS hashes everything native (dependencies with
 * native code, app config, plugins, permissions). An update only reaches builds with the same
 * fingerprint, so a JS update can never land on a build whose native side does not match it.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  // The app's tsconfig has no Node types; the config runs in Node, where this is process.env.
  const env = process.env as Readonly<Record<string, string | undefined>>;
  const iosBundleId = env.APP_IOS_BUNDLE_ID ?? 'no.amexbutikker.app';
  const androidPackage = env.APP_ANDROID_PACKAGE ?? 'no.amexbutikker.app';
  const extra = config.extra as { eas?: { projectId?: string } } | undefined;
  const projectId = env.EAS_PROJECT_ID ?? extra?.eas?.projectId;

  return {
    ...config,
    name: 'amexbutikker',
    slug: 'amexbutikker',
    ios: { ...config.ios, bundleIdentifier: iosBundleId },
    android: { ...config.android, package: androidPackage },
    runtimeVersion: { policy: 'fingerprint' },
    ...(projectId === undefined || projectId === ''
      ? {}
      : {
          updates: { url: `https://u.expo.dev/${projectId}` },
          extra: { ...config.extra, eas: { projectId } },
        }),
  };
};
