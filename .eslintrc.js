module.exports = {
  "rules": {
    "indent": [
      "error",
      2
    ],
    "quotes": [
      2,
      "double"
    ],
    "linebreak-style": [
      2,
      "unix"
    ],
    "max-len": [
      "error",
      80
    ],
    "semi": [
      2,
      "always"
    ],
    "no-console": "off",
    "comma-dangle": [
      "error",
      "always"
    ],
  },
  "env": {
      "es6": true,
      "browser": true
  },
  "parserOptions": {
      "ecmaVersion": 2017
  },
  "extends": "eslint:recommended"
};
