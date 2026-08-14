import { BaseService } from "./base-service.mjs";
import {
  PHABRICATOR_ROOT,
  PHABRICATOR_DASHBOARD,
  PHABRICATOR_COOKIE_NAME,
  PHABRICATOR_SELECTORS,
  PHABRICATOR_REVIEW_HEADERS,
  PHABRICATOR_API,
  PHABRICATOR_METHODS,
  PHABRICATOR_ACTIVE_QUERY_KEY,
  PHABRICATOR_MUST_REVIEW_STATUSES,
  PHABRICATOR_READY_REVIEW_STATUSES,
  PHABRICATOR_REVIEWER_STATUSES,
  PHABRICATOR_REVISION_STATUSES,
  PHABRICATOR_AUTH_ERROR_CODES,
  PHABRICATOR_MAX_PAGES,
  PHABRICATOR_GROUP_CACHE_MS,
  SERVICE_TYPES,
  HTTP_METHODS,
  HTTP_HEADERS
} from "../constants.mjs";

/**
 * Service for fetching Phabricator review counts.
 *
 * Has two paths. If an API token is configured, counts are read from the
 * Conduit API and bucketed locally. Otherwise the original path runs, parsing
 * the dashboard HTML using the browser's Phabricator session cookie.
 */
export class PhabricatorService extends BaseService {
  /**
   * Cached identity and reviewer-group membership for the Conduit path, keyed
   * by token so a changed token invalidates it. Held in memory rather than
   * settings, since background.mjs owns the persisted services array.
   */
  #conduitCache = null;

  /**
   * Updates Phabricator review counts, via Conduit if a token is configured
   * and by scraping the dashboard otherwise.
   *
   * @param {Object} settings - Phabricator service settings
   * @param {string} [settings.apiToken] - Conduit API token (selects the Conduit path)
   * @param {number} [settings.container] - Firefox container ID (undefined = disabled)
   * @param {boolean} [settings.inclReviewerGroups] - Include group review counts
   * @returns {Promise<Object>} Object with reviewTotal, userReviewTotal, groupReviewTotal
   */
  async update(settings) {
    if (settings.apiToken) {
      return this.#updateViaConduit(settings);
    }

    return this.#updateViaScraping(settings);
  }

  /**
   * The original scraping path, unchanged: requires a Phabricator session
   * cookie in the default container.
   *
   * @param {Object} settings - Phabricator service settings
   * @returns {Promise<Object>} Object with reviewTotal, userReviewTotal, groupReviewTotal
   */
  async #updateViaScraping(settings) {
    if (settings.container === undefined) {
      console.log("Phabricator service is disabled.");
      return {
        disabled: true,
        reviewTotal: 0,
        userReviewTotal: 0,
        groupReviewTotal: 0
      };
    }

    if (await this.#hasCookie()) {
      console.log(
        "Phabricator session found! Attempting to get dashboard page."
      );

      let { ok, reviewTotal, userReviewTotal, groupReviewTotal } =
        await this._fetchReviewRequests();
      return { connected: ok, reviewTotal, userReviewTotal, groupReviewTotal };
    } else {
      console.log(
        "No Phabricator session found. I won't try to fetch anything for it."
      );
      return {
        connected: false,
        reviewTotal: 0,
        userReviewTotal: 0,
        groupReviewTotal: 0
      };
    }
  }

  /**
   * Checks if Phabricator service is configured, by either path.
   *
   * @param {Object} settings - Phabricator service settings
   * @returns {boolean} True if a token is set or the container is defined
   */
  isConfigured(settings) {
    return !!settings.apiToken || settings.container !== undefined;
  }

  /**
   * Returns the Phabricator dashboard URL.
   *
   * @param {Object} settings - Phabricator service settings
   * @returns {string} Dashboard URL
   */
  getDashboardUrl(settings) {
    return [PHABRICATOR_ROOT, PHABRICATOR_DASHBOARD].join("/");
  }

  /**
   * Returns the service type identifier.
   *
   * @returns {string} "phabricator"
   */
  getType() {
    return SERVICE_TYPES.PHABRICATOR;
  }

  /**
   * Checks if there is an active Phabricator session by verifying the cookie
   * exists and the dashboard page is accessible.
   *
   * @param {Object} options - Options object
   * @param {string|null} [options.testingURL] - Optional URL for testing
   * @returns {Promise<boolean>} True if session is active, false otherwise
   */
  async hasSession({ testingURL = null } = {}) {
    if (await this.#hasCookie()) {
      let { ok } = await this.#fetchDocumentBody({ testingURL });
      return ok;
    }

    return false;
  }

  /**
   * Gets the HTML body of the Phabricator dashboard for debugging.
   *
   * @returns {Promise<Object>} Object with ok and pageBody
   */
  async getDocumentBodyForDebug() {
    return this.#fetchDocumentBody();
  }

  /**
   * Checks if the Phabricator session cookie (phsid) exists.
   *
   * @returns {Promise<boolean>} True if cookie exists, false otherwise
   */
  async #hasCookie() {
    let phabCookie = await browser.cookies.get({
      url: PHABRICATOR_ROOT,
      name: PHABRICATOR_COOKIE_NAME
    });
    return !!phabCookie;
  }

  /**
   * Fetches the Phabricator dashboard page HTML.
   *
   * @param {Object} options - Options object
   * @param {string|null} [options.testingURL] - Optional URL for testing
   * @returns {Promise<Object>} Object with ok (boolean) and pageBody (string)
   */
  async #fetchDocumentBody({ testingURL = null } = {}) {
    let url = testingURL || [PHABRICATOR_ROOT, PHABRICATOR_DASHBOARD].join("/");

    let req = new Request(url, {
      method: HTTP_METHODS.GET,
      headers: {
        "Content-Type": HTTP_HEADERS.CONTENT_TYPE_HTML
      },
      redirect: "follow"
    });

    let resp = await window.fetch(req);
    let ok = resp.ok;
    let pageBody = await resp.text();
    return { ok, pageBody };
  }

  /**
   * Parses the Phabricator dashboard HTML to extract review counts.
   * Distinguishes between reviews directly assigned to the user vs. assigned
   * to groups the user belongs to.
   *
   * Note: This method uses _ prefix instead of # to allow testing access.
   *
   * @param {Object} options - Options object
   * @param {string} [options.testingURL] - Optional URL for testing
   * @returns {Promise<Object>} Object with ok, reviewTotal, userReviewTotal, groupReviewTotal
   */
  async _fetchReviewRequests({ testingURL = null } = {}) {
    let { ok, pageBody } = await this.#fetchDocumentBody({ testingURL });
    let parser = new DOMParser();
    let doc = parser.parseFromString(pageBody, "text/html");

    let userMenu = doc.querySelector(PHABRICATOR_SELECTORS.USER_MENU);
    let userId = userMenu.href;

    let headers = doc.querySelectorAll(PHABRICATOR_SELECTORS.HEADER);
    let userReviewTotal = 0;
    let groupReviewTotal = 0;

    for (let header of headers) {
      if (PHABRICATOR_REVIEW_HEADERS.includes(header.textContent)) {
        let box = header.closest(PHABRICATOR_SELECTORS.BOX);
        let rows = box.querySelectorAll(PHABRICATOR_SELECTORS.TABLE_ROW);
        let localUserReviewTotal = 0;
        for (let row of rows) {
          let reviewers = row.querySelectorAll(
            PHABRICATOR_SELECTORS.LINK_PERSON
          );
          for (let reviewer of reviewers) {
            let reviewerId = reviewer.href;
            if (reviewerId == userId) {
              localUserReviewTotal++;
              break;
            }
          }
        }

        userReviewTotal += localUserReviewTotal;
        groupReviewTotal += rows.length - localUserReviewTotal;
      }
    }

    let reviewTotal = userReviewTotal;

    return { ok, reviewTotal, userReviewTotal, groupReviewTotal };
  }

  /**
   * Validates a Conduit API token and resolves the account it belongs to.
   *
   * @param {Object} settings - Phabricator service settings
   * @returns {Promise<Object>} Object with valid, and userName / error
   */
  async validateToken(settings) {
    if (!settings.apiToken) {
      return { valid: false };
    }

    try {
      let me = await this.#conduit(
        settings.apiToken,
        PHABRICATOR_METHODS.WHOAMI
      );
      return { valid: true, userName: me.userName, userPHID: me.phid };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  /**
   * Fetches review counts over the Conduit API.
   *
   * Authentication failures resolve with connected: false, since the user has
   * to go fix the token. Everything else throws, so that background.mjs keeps
   * the last known counts rather than flashing a zero badge on a transient
   * network or WAF failure.
   *
   * @param {Object} settings - Phabricator service settings
   * @returns {Promise<Object>} Object with reviewTotal, userReviewTotal, groupReviewTotal
   */
  async #updateViaConduit(settings) {
    let token = settings.apiToken;

    let cache;
    try {
      cache = await this.#getConduitCache(token);
    } catch (e) {
      if (this.#isAuthError(e)) {
        console.error("Phabricator rejected the API token: ", e.message);
        return {
          connected: false,
          reviewTotal: 0,
          userReviewTotal: 0,
          groupReviewTotal: 0
        };
      }
      throw e;
    }

    let revisions = await this.#fetchActiveRevisions(token);
    let counts = this._bucketRevisions(
      revisions,
      [cache.userPHID, ...cache.groupPHIDs],
      cache.userPHID
    );

    return { connected: true, ...counts };
  }

  /**
   * Resolves the user's PHID and reviewer-group PHIDs, caching them for
   * PHABRICATOR_GROUP_CACHE_MS so a poll normally costs one request.
   *
   * @param {string} token - Conduit API token
   * @returns {Promise<Object>} Object with userPHID and groupPHIDs
   */
  async #getConduitCache(token) {
    let fresh =
      this.#conduitCache &&
      this.#conduitCache.token == token &&
      Date.now() - this.#conduitCache.fetchedAt < PHABRICATOR_GROUP_CACHE_MS;

    if (fresh) {
      return this.#conduitCache;
    }

    let me = await this.#conduit(token, PHABRICATOR_METHODS.WHOAMI);
    let projects = await this.#conduitSearchAll(
      token,
      PHABRICATOR_METHODS.PROJECT_SEARCH,
      { constraints: { members: [me.phid] } }
    );

    this.#conduitCache = {
      token,
      userPHID: me.phid,
      groupPHIDs: projects.map((p) => p.phid),
      fetchedAt: Date.now()
    };

    return this.#conduitCache;
  }

  /**
   * Fetches every revision in the user's "Active Revisions" query, which is
   * the same set the scraped dashboard page shows.
   *
   * @param {string} token - Conduit API token
   * @returns {Promise<Array>} Revision objects with their reviewers attachment
   */
  async #fetchActiveRevisions(token) {
    return this.#conduitSearchAll(token, PHABRICATOR_METHODS.REVISION_SEARCH, {
      queryKey: PHABRICATOR_ACTIVE_QUERY_KEY,
      attachments: { reviewers: true }
    });
  }

  /**
   * Runs a Conduit *.search method, following result cursors.
   *
   * @param {string} token - Conduit API token
   * @param {string} method - Conduit method name
   * @param {Object} params - Method parameters
   * @returns {Promise<Array>} The concatenated data from every page
   */
  async #conduitSearchAll(token, method, params) {
    let all = [];
    let after = null;
    let pages = 0;

    do {
      let result = await this.#conduit(token, method, {
        ...params,
        ...(after ? { after } : {})
      });
      all.push(...result.data);
      after = result.cursor ? result.cursor.after : null;
      pages++;
    } while (after && pages < PHABRICATOR_MAX_PAGES);

    if (after) {
      console.warn(
        `Phabricator ${method} hit the ${PHABRICATOR_MAX_PAGES} page cap; ` +
          "counts may be low."
      );
    }

    return all;
  }

  /**
   * Makes a single Conduit API call.
   *
   * Credentials are omitted deliberately: the token is the only credential
   * wanted here, and anonymous Conduit responses try to set a phsid cookie
   * that would otherwise land in the browser's cookie jar.
   *
   * @param {string} token - Conduit API token
   * @param {string} method - Conduit method name
   * @param {Object} [params] - Method parameters
   * @returns {Promise<Object>} The method's result
   */
  async #conduit(token, method, params = {}) {
    let req = new Request(`${PHABRICATOR_API}/${method}`, {
      method: HTTP_METHODS.POST,
      headers: {
        "Content-Type": HTTP_HEADERS.CONTENT_TYPE_FORM
      },
      body: this.#encodeConduitParams({ "api.token": token, ...params }),
      credentials: "omit",
      redirect: "follow"
    });

    let resp = await window.fetch(req);
    if (!resp.ok) {
      // A bodyless 406 here is the WAF rejecting the request outright rather
      // than Phabricator answering with an error envelope.
      throw new Error(`Phabricator ${method} failed (HTTP ${resp.status})`);
    }

    let json = await resp.json();
    if (json.error_code) {
      let error = new Error(`${json.error_code}: ${json.error_info}`);
      error.conduitErrorCode = json.error_code;
      throw error;
    }

    return json.result;
  }

  /**
   * Flattens nested parameters into Conduit's bracket form encoding, so that
   * {constraints: {members: ["PHID"]}} becomes constraints[members][0]=PHID.
   *
   * @param {Object} params - Parameters to encode
   * @param {string} [prefix] - Key prefix used when recursing
   * @param {URLSearchParams} [body] - Accumulator used when recursing
   * @returns {URLSearchParams} The encoded body
   */
  #encodeConduitParams(params, prefix = "", body = new URLSearchParams()) {
    for (let [key, value] of Object.entries(params)) {
      let name = prefix ? `${prefix}[${key}]` : key;

      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          body.append(`${name}[${index}]`, String(item));
        });
      } else if (typeof value == "object") {
        this.#encodeConduitParams(value, name, body);
      } else {
        body.append(name, String(value));
      }
    }

    return body;
  }

  /**
   * @param {Error} error - An error thrown by #conduit
   * @returns {boolean} True if the error means the token was rejected
   */
  #isAuthError(error) {
    return PHABRICATOR_AUTH_ERROR_CODES.includes(error.conduitErrorCode);
  }

  /**
   * Sorts revisions into the dashboard's "Must Review" and "Ready to Review"
   * buckets. This reimplements Phabricator's
   * DifferentialRevisionRequiredActionResultBucket, which the Conduit API
   * does not apply to its own results.
   *
   * Note: this method uses _ prefix instead of # to allow testing access.
   *
   * @param {Array} revisions - Revisions with their reviewers attachment
   * @param {Array} minePHIDs - The user's PHID plus their reviewer-group PHIDs
   * @param {string} userPHID - The user's own PHID
   * @returns {Object} Object with reviewTotal, userReviewTotal, groupReviewTotal
   */
  _bucketRevisions(revisions, minePHIDs, userPHID) {
    let mine = new Set(minePHIDs);
    let userReviewTotal = 0;
    let groupReviewTotal = 0;

    for (let revision of revisions) {
      let { authorPHID, status } = revision.fields;
      let reviewers = revision.attachments?.reviewers?.reviewers || [];
      let mineReviewers = reviewers.filter((r) => mine.has(r.reviewerPHID));

      if (mine.has(authorPHID)) {
        continue;
      }

      if (
        mineReviewers.some(
          (r) => r.status == PHABRICATOR_REVIEWER_STATUSES.RESIGNED
        )
      ) {
        continue;
      }

      if (status?.value != PHABRICATOR_REVISION_STATUSES.NEEDS_REVIEW) {
        continue;
      }

      let matched = mineReviewers.filter((r) =>
        PHABRICATOR_MUST_REVIEW_STATUSES.includes(r.status)
      );

      if (!matched.length) {
        matched = mineReviewers.filter((r) =>
          PHABRICATOR_READY_REVIEW_STATUSES.includes(r.status)
        );
      }

      if (!matched.length) {
        continue;
      }

      if (matched.some((r) => r.reviewerPHID == userPHID)) {
        userReviewTotal++;
      } else {
        groupReviewTotal++;
      }
    }

    return { reviewTotal: userReviewTotal, userReviewTotal, groupReviewTotal };
  }
}
