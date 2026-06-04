const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withNoCompress(config) {
  return withAppBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;

    // Check if aaptOptions is already configured for tflite to avoid duplication
    if (!buildGradle.includes('noCompress "tflite"') && !buildGradle.includes("noCompress 'tflite'")) {
      buildGradle = buildGradle.replace(
        /android\s*\{/,
        `android {
    aaptOptions {
        noCompress "tflite"
    }`
      );
      config.modResults.contents = buildGradle;
    }
    return config;
  });
};
