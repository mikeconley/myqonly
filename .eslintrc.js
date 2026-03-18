/* eslint-env node */
module.exports = {
  rules: {
    "no-console": "off"
  },
  env: {
    es6: true,
    browser: true
  },
  parserOptions: {
    ecmaVersion: 2017
  },
  extends: ["eslint:recommended", "prettier"]
};
