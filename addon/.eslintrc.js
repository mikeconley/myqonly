"use strict";

module.exports = {
  "extends": "../.eslintrc.js",

  "globals": {
    "PHABRICATOR_ROOT": true,
    "PHABRICATOR_DASHBOARD": true,
    "PHABRICATOR_REVIEW_HEADERS": true,
    "BUGZILLA_API": true,
    "GITHUB_API": true,
    "GITLAB_API_DEFAULT_DOMAIN": true,
    "GITLAB_API_PATH": true,
    "GITLAB_DEFAULT_DOMAIN": true,
    "GITLAB_TODOS_PATH": true,
    "DEFAULT_UPDATE_INTERVAL": true,
    "ALARM_NAME": true,
    "FEATURE_ALERT_REV": true,
    "FEATURE_ALERT_BG_COLOR": true,
    "FEATURE_ALERT_STRING": true,
    "browser": true,
    "chrome": true,
  },
};
