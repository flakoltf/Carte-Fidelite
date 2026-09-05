import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scripts Node utilitaires (require() légitime, hors graphe applicatif).
    "scripts/**",
    // Worktrees et état local de Claude Code (contiennent des builds .next).
    ".claude/**",
    // App mobile Expo : projet autonome, avec sa propre config ESLint/TS et sa
    // propre CI (.github/workflows/mobile-ci.yml).
    "mobile/**",
  ]),
  // Autorise les paramètres/variables préfixés `_` (intentionnellement inutilisés).
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // Fichiers de test : les mocks et cas limites utilisent légitimement `any`.
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Tests E2E Playwright : code Node pur (aucun React) ; la convention
  // `await use(value)` dans `base.extend({ fixture: async ({}, use) => {...} })`
  // déclenche un faux positif `react-hooks/rules-of-hooks` (homonymie avec le
  // hook React `use`). On désactive cette règle pour le dossier `e2e/` seul.
  {
    files: ["e2e/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);

export default eslintConfig;
