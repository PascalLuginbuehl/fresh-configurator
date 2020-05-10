module.exports = {
  resetMocks: true,
  preset: "ts-jest",
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/build/",
    "/storybook-static/",
    "/__generated__/",
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    "**/*.{ts,tsx}",
    "!**/node_modules/**",
    "!./tools/**/*",
    "!**/stories/**",
    "!**/__generated__/**",
    "!**/test/**",
    "!**/test-utils.*",
    "!**/dist/**",
    "!**/build/**",
    "!**/mocks/**",
    "!**/*.d.ts",
  ],
  modulePathIgnorePatterns: [
    "<rootDir>/e2e/",
    "<rootDir>/build/",
    "<rootDir>/dist/",
    "<rootDir>/.*/__mocks__",
  ],
};
