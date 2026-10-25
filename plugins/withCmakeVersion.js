// Pins the CMake version used for the app's native (C++) build.
//
// Why: Android Gradle Plugin defaults to CMake 3.22.1, whose bundled ninja (1.10.2) is not
// long-path aware. React Native's codegen object paths exceed Windows' 260-char limit
// ("ninja: error: Stat(...): Filename longer than 260 characters"). The ninja shipped with
// CMake 3.31.x (1.12.1) declares longPathAware, which works with Windows' LongPathsEnabled=1.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// remainder: pin CMake version (long-path-aware ninja)';

module.exports = function withCmakeVersion(config, { version = '3.31.6' } = {}) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withCmakeVersion: expected a Groovy app/build.gradle');
    }
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) return cfg; // already applied

    const patched = contents.replace(
      /^android\s*\{/m,
      `android {\n    ${MARKER}\n    externalNativeBuild {\n        cmake {\n            version "${version}"\n        }\n    }\n`,
    );
    if (patched === contents) {
      throw new Error('withCmakeVersion: could not find the android { } block in app/build.gradle');
    }
    cfg.modResults.contents = patched;
    return cfg;
  });
};
