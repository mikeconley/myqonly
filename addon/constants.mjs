export const PHABRICATOR_ROOT = "https://phabricator.services.mozilla.com";
export const PHABRICATOR_DASHBOARD = "differential/query/active/";
export const PHABRICATOR_REVIEW_HEADERS = ["Must Review", "Ready to Review"];
export const PHABRICATOR_COOKIE_NAME = "phsid";
export const PHABRICATOR_SELECTORS = {
  USER_MENU: "a.phabricator-core-user-menu[href^='/p/']",
  HEADER: ".phui-header-header",
  BOX: ".phui-box",
  TABLE_ROW: ".phui-oi-table-row",
  LINK_PERSON: ".phui-link-person"
};

export const BUGZILLA_API =
  "https://bugzilla.mozilla.org/rest/mydashboard/run_flag_query";
export const BUGZILLA_DASHBOARD =
  "https://bugzilla.mozilla.org/page.cgi?id=mydashboard.html";

export const GITHUB_API = "https://api.github.com/search/issues";
export const GITHUB_REVIEW_URL = "https://github.com/pulls/review-requested";

export const SERVICE_TYPES = {
  PHABRICATOR: "phabricator",
  BUGZILLA: "bugzilla",
  GITHUB: "github"
};

export const STORAGE_KEYS = {
  FEATURE_REV: "featureRev",
  UPDATE_INTERVAL: "updateInterval",
  SERVICES: "services",
  WORKING_HOURS: "workingHours",
  NEEDS_GITHUB_MIGRATION: "needsGitHubMigration",
  OLD_IGNORED_REPOS: "oldIgnoredRepos",
  REVIEW_STATES: "reviewStates"
};

export const MESSAGE_TYPES = {
  REFRESH: "refresh",
  GET_FEATURE_REV: "get-feature-rev",
  OPENED_RELEASE_NOTES: "opened-release-notes",
  CHECK_PHABRICATOR_SESSION: "check-for-phabricator-session",
  GET_PHABRICATOR_HTML: "get-phabricator-html"
};

export const HTTP_HEADERS = {
  CONTENT_TYPE_HTML: "text/html"
};

export const HTTP_METHODS = {
  GET: "GET",
  POST: "POST"
};

export const DEFAULT_UPDATE_INTERVAL = 5; // minutes
export const ALARM_NAME = "check-for-updates";

export const FEATURE_ALERT_REV = 4;
export const FEATURE_ALERT_BG_COLOR = "#EC9329";
export const FEATURE_ALERT_STRING = "New";
