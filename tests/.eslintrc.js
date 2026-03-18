/* eslint-env node */
"use strict";

module.exports = {
  extends: ["../.eslintrc.js", "../addon/.eslintrc.js"],

  globals: {
    describe: true,
    beforeEach: true,
    afterEach: true,
    it: true,
    assert: true,
    should: true,
    browser: true,
    chrome: true,
    MyQOnly: true,
    sinon: true,
    BaseService: true,
    PhabricatorService: true,
    BugzillaService: true,
    GitHubService: true,
    ServiceRegistry: true
  }
};
