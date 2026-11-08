// Adds the "Registrer Amex-betaling" App Intent to the iOS app target. App Intents must be
// compiled into the app itself (not a pod) for Shortcuts to find them, so the Swift file is
// copied into the generated project and added to its sources on every prebuild.
const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const FILE = 'RecordAmexPaymentIntent.swift';

/** @param {import('expo/config').ExpoConfig} config */
function withPaymentIntent(config) {
  config = withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(modConfig.modRequest.projectRoot);
      fs.copyFileSync(
        path.join(__dirname, 'payment-intent', FILE),
        path.join(modConfig.modRequest.platformProjectRoot, projectName, FILE),
      );
      return modConfig;
    },
  ]);
  return withXcodeProject(config, (modConfig) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(modConfig.modRequest.projectRoot);
    const filepath = `${projectName}/${FILE}`;
    if (!modConfig.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: projectName,
        project: modConfig.modResults,
      });
    }
    return modConfig;
  });
}

module.exports = withPaymentIntent;
