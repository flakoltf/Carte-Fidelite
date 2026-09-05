/** Tests du socle : composants et logique d'auth, sans appareil ni réseau. */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/__tests__/**"],
};
