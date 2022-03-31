module.exports = {
  root: true,
  extends: ['@mongodb-js/eslint-config-compass'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig-lint.json'],
    sourceType: 'module',
  },
  env: {
    node: true,
    browser: true,
  },
};
