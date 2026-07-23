// Force every CocoaPods target to the app's minimum iOS version. Some
// third-party pods still declare 9.0/12.x deployment targets, which newer Xcode
// (floor 15.0) rejects. Runs on every `expo prebuild`, so it survives
// regeneration of the ios/ folder.
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MIN_TARGET = "16.0";
const MARKER = "min-ios-deployment-target";

module.exports = function withIosDeploymentTarget(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfile, "utf8");
      if (!contents.includes(MARKER)) {
        const inject = `
    # ${MARKER}: bump every pod to iOS ${MIN_TARGET} (Xcode's floor is 15.0).
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |bc|
        bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_TARGET}'
      end
    end
`;
        contents = contents.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|\n${inject}`,
        );
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
