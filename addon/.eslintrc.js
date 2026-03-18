/* eslint-env node */
"use strict";

module.exports = {
  extends: "../.eslintrc.js",

  globals: {
    PHABRICATOR_ROOT: true,
    PHABRICATOR_DASHBOARD: true,
    PHABRICATOR_REVIEW_HEADERS: true,
    PHABRICATOR_COOKIE_NAME: true,
    PHABRICATOR_SELECTORS: true,
    BUGZILLA_API: true,
    BUGZILLA_METHOD: true,
    BUGZILLA_REQUEST_ID: true,
    BUGZILLA_VERSION: true,
    GITHUB_API: true,
    GITHUB_REVIEW_URL: true,
    SERVICE_TYPES: true,
    STORAGE_KEYS: true,
    MESSAGE_TYPES: true,
    HTTP_HEADERS: true,
    HTTP_METHODS: true,
    DEFAULT_UPDATE_INTERVAL: true,
    ALARM_NAME: true,
    FEATURE_ALERT_REV: true,
    FEATURE_ALERT_BG_COLOR: true,
    FEATURE_ALERT_STRING: true,
    browser: true,
    chrome: true
  }
};
