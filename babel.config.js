module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin is added automatically by babel-preset-expo
    // when react-native-worklets is installed (needed by VisionCamera frame output).
  };
};
