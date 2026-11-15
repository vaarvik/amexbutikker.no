// Adds the payment App Intents ("Registrer Amex-betaling", "Registrer annen betaling") to the
// iOS app target. App Intents must be compiled into the app itself (not a pod) for Shortcuts to
// find them, so the Swift files are copied into the generated project and added to its sources
// on every prebuild.
const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const FILES = [
  'PaymentLink.swift',
  'RecordAmexPaymentIntent.swift',
  'RecordOtherPaymentIntent.swift',
];

/** @param {import('expo/config').ExpoConfig} config */
function withPaymentIntent(config) {
  config = withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(modConfig.modRequest.projectRoot);
      for (const file of FILES) {
        fs.copyFileSync(
          path.join(__dirname, 'payment-intent', file),
          path.join(modConfig.modRequest.platformProjectRoot, projectName, file),
        );
      }
      return modConfig;
    },
  ]);
  return withXcodeProject(config, (modConfig) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(modConfig.modRequest.projectRoot);
    for (const file of FILES) {
      const filepath = `${projectName}/${file}`;
      if (!modConfig.modResults.hasFile(filepath)) {
        IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
          filepath,
          groupName: projectName,
          project: modConfig.modResults,
        });
      }
    }
    return modConfig;
  });
}

module.exports = withPaymentIntent;
