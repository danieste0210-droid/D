module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated/plugin debe ir siempre último en la lista.
    plugins: ['react-native-reanimated/plugin'],
  };
};
