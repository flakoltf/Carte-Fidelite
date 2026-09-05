// Configuration ESLint « à plat » — base Expo (React, React Hooks, RN, import).
const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: ["node_modules/**", ".expo/**", "dist/**", "coverage/**"],
  },
  {
    rules: {
      // `any` est déjà barré par le TS strict du tsconfig ; ici on garde la
      // console propre (les logs de debug ne partent pas en production).
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];
