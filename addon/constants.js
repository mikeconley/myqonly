/* eslint-disable no-unused-vars */

const PHABRICATOR_ROOT = "https://phabricator.services.mozilla.com";
const PHABRICATOR_DASHBOARD = "differential/query/active/";
const PHABRICATOR_REVIEW_HEADERS = [
  "Must Review",
  "Ready to Review",
];
const BUGZILLA_API = "https://bugzilla.mozilla.org/jsonrpc.cgi";
const GITHUB_API = "https://api.github.com/search/issues";
const GITLAB_API_DEFAULT_DOMAIN = "https://api.gitlab.com";
const GITLAB_DEFAULT_DOMAIN = "https://gitlab.com";
const GITLAB_API_PATH = "api/v4/todos";
const GITLAB_TODOS_PATH = "/dashboard/todos";

const DEFAULT_UPDATE_INTERVAL = 5; // minutes
const ALARM_NAME = "check-for-updates";

// Anytime we want to alert the user about changes in the changelog, we should
// bump the revision number here.
const FEATURE_ALERT_REV = 3;
const FEATURE_ALERT_BG_COLOR = "#EC9329";
const FEATURE_ALERT_STRING = "New";