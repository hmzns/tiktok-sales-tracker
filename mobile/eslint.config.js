// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      // These screens intentionally fetch remote data when routes or filters change.
      // The loaders set a pending state before their first await, which this new
      // React rule currently treats as a synchronous effect update.
      "react-hooks/set-state-in-effect": "off",
    },
  }
]);
