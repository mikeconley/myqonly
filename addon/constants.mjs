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

export const PHABRICATOR_API = `${PHABRICATOR_ROOT}/api`;
export const PHABRICATOR_TOKEN_SETTINGS_URL = `${PHABRICATOR_ROOT}/settings/panel/apitokens/`;

export const PHABRICATOR_TOKEN_STATES = {
  UNSET: "unset",
  CHECKING: "checking",
  VALID: "valid",
  INVALID: "invalid"
};

// The cookieStoreId for "no container", and the value stored when the user
// has not picked one.
export const NO_CONTAINER = "";

export const PHABRICATOR_METHODS = {
  WHOAMI: "user.whoami",
  REVISION_SEARCH: "differential.revision.search",
  PROJECT_SEARCH: "project.search"
};

export const PHABRICATOR_ACTIVE_QUERY_KEY = "active";

export const PHABRICATOR_MUST_REVIEW_STATUSES = [
  "blocking",
  "rejected",
  "rejected-older"
];

// Phabricator also counts "accepted" as ready to review, but only once the
// accept has been voided by the author using "Request Review". Voided state is
// not exposed over Conduit, and on real data every "accepted" reviewer was
// instead waiting on some other blocking reviewer, so counting them overstated
// the total by roughly half.
export const PHABRICATOR_READY_REVIEW_STATUSES = ["added", "commented"];

export const PHABRICATOR_REVIEWER_STATUSES = {
  ACCEPTED: "accepted",
  RESIGNED: "resigned"
};

export const PHABRICATOR_REVISION_STATUSES = {
  NEEDS_REVIEW: "needs-review",
  DRAFT: "draft"
};

export const PHABRICATOR_AUTH_ERROR_CODES = [
  "ERR-INVALID-AUTH",
  "ERR-INVALID-SESSION",
  "ERR-INVALID-TOKEN",
  "ERR-PERMISSIONS"
];

export const PHABRICATOR_MAX_PAGES = 10;

export const PHABRICATOR_GROUP_CACHE_MS = 24 * 60 * 60 * 1000;

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
  VALIDATE_PHABRICATOR_TOKEN: "validate-phabricator-token",
  GET_PHABRICATOR_HTML: "get-phabricator-html"
};

export const HTTP_HEADERS = {
  CONTENT_TYPE_HTML: "text/html",
  CONTENT_TYPE_FORM: "application/x-www-form-urlencoded"
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
