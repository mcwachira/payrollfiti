/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['@repo/eslint-config/next.js'],
  parserOptions: {
    project: true,
  },
  // Runs in the ServiceWorkerGlobalScope, not the DOM — excluded from
  // tsconfig.json's project (see the comment there), so type-aware ESLint
  // rules can't parse it either.
  ignorePatterns: ['app/sw.ts'],
};
