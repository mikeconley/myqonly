/* eslint-disable no-unused-vars, no-redeclare */

const PHABRICATOR_ROOT = "https://phabricator.services.mozilla.com";
const PHABRICATOR_DASHBOARD = "differential/query/active/";
const PHABRICATOR_REVIEW_HEADERS = ["Must Review", "Ready to Review"];
const PHABRICATOR_COOKIE_NAME = "phsid";
const PHABRICATOR_SELECTORS = {
  USER_MENU: "a.phabricator-core-user-menu[href^='/p/']",
  HEADER: ".phui-header-header",
  BOX: ".phui-box",
  TABLE_ROW: ".phui-oi-table-row",
  LINK_PERSON: ".phui-link-person"
};

const BUGZILLA_API = "https://bugzilla.mozilla.org/jsonrpc.cgi";
const BUGZILLA_METHOD = "MyDashboard.run_flag_query";
const BUGZILLA_REQUEST_ID = 4;
const BUGZILLA_VERSION = "1.1";

const GITHUB_API = "https://api.github.com/search/issues";
const GITHUB_REVIEW_URL = "https://github.com/pulls/review-requested";

const SERVICE_TYPES = {
  PHABRICATOR: "phabricator",
  BUGZILLA: "bugzilla",
  GITHUB: "github"
};

const STORAGE_KEYS = {
  FEATURE_REV: "featureRev",
  UPDATE_INTERVAL: "updateInterval",
  SERVICES: "services",
  WORKING_HOURS: "workingHours",
  NEEDS_GITHUB_MIGRATION: "needsGitHubMigration",
  OLD_IGNORED_REPOS: "oldIgnoredRepos"
};

const MESSAGE_TYPES = {
  GET_STATES: "get-states",
  REFRESH: "refresh",
  GET_FEATURE_REV: "get-feature-rev",
  OPENED_RELEASE_NOTES: "opened-release-notes",
  CHECK_PHABRICATOR_SESSION: "check-for-phabricator-session",
  GET_PHABRICATOR_HTML: "get-phabricator-html"
};

const HTTP_HEADERS = {
  CONTENT_TYPE_HTML: "text/html",
  CONTENT_TYPE_JSON: "application/json"
};

const HTTP_METHODS = {
  GET: "GET",
  POST: "POST"
};

const DEFAULT_UPDATE_INTERVAL = 5; // minutes
const ALARM_NAME = "check-for-updates";

const FEATURE_ALERT_REV = 3;
const FEATURE_ALERT_BG_COLOR = "#EC9329";
const FEATURE_ALERT_STRING = "New";
