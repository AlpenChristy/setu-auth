const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add 'tflite' to asset extensions list so that require('./path/to/model.tflite') is resolved correctly
config.resolver.assetExts.push('tflite');

module.exports = config;
