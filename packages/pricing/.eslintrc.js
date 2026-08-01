/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['@repo/eslint-config/library.js'],
  parserOptions: {
    project: 'tsconfig.lint.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
};
