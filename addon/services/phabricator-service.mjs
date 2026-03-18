import { BaseService } from "./base-service.mjs";
import {
  PHABRICATOR_ROOT,
  PHABRICATOR_DASHBOARD,
  PHABRICATOR_COOKIE_NAME,
  PHABRICATOR_SELECTORS,
  PHABRICATOR_REVIEW_HEADERS,
  SERVICE_TYPES,
  HTTP_METHODS,
  HTTP_HEADERS
} from "../constants.mjs";

/**
 * Service for fetching Phabricator review counts.
 * Parses the Phabricator dashboard HTML to extract reviews assigned to
 * the user and optionally to groups the user belongs to.
 */
export class PhabricatorService extends BaseService {
  /**
   * Updates Phabricator review counts for the logged-in user.
   *
   * @param {Object} settings - Phabricator service settings
   * @param {number} [settings.container] - Firefox container ID (undefined = disabled)
   * @param {boolean} [settings.inclReviewerGroups] - Include group review counts
   * @returns {Promise<Object>} Object with reviewTotal, userReviewTotal, groupReviewTotal
   */
  async update(settings) {
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
   * Checks if Phabricator service is configured (container is set).
   *
   * @param {Object} settings - Phabricator service settings
   * @returns {boolean} True if container is defined
   */
  isConfigured(settings) {
    return settings.container !== undefined;
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
}
