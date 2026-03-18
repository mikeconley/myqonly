import { BaseService } from "./base-service.mjs";
import {
  BUGZILLA_API,
  BUGZILLA_DASHBOARD,
  BUGZILLA_METHOD,
  BUGZILLA_REQUEST_ID,
  BUGZILLA_VERSION,
  SERVICE_TYPES,
  HTTP_METHODS,
  HTTP_HEADERS
} from "../constants.mjs";

/**
 * Service for fetching Bugzilla review and needinfo counts.
 * Uses the Bugzilla JSON-RPC API to fetch flags requested from the user.
 */
export class BugzillaService extends BaseService {
  /**
   * Updates Bugzilla review and needinfo counts using the Bugzilla API.
   *
   * @param {Object} settings - Bugzilla service settings
   * @param {string} settings.apiKey - Bugzilla API key
   * @param {boolean} [settings.needinfos] - Whether to include needinfo counts
   * @returns {Promise<Object>} Object with reviewTotal and needinfoTotal
   */
  async update(settings) {
    let apiKey = settings.apiKey;
    if (!apiKey) {
      return { reviewTotal: 0, needinfoTotal: 0 };
    }

    // I'm not sure how much of this is necessary - I just looked at what
    // the Bugzilla My Dashboard thing does in the network inspector, and
    // I'm more or less mimicking that here.
    let body = JSON.stringify({
      id: BUGZILLA_REQUEST_ID,
      method: BUGZILLA_METHOD,
      params: {
        Bugzilla_api_key: apiKey,
        type: "requestee"
      },
      version: BUGZILLA_VERSION
    });

    let req = new Request(BUGZILLA_API, {
      method: HTTP_METHODS.POST,
      headers: {
        "Content-Type": HTTP_HEADERS.CONTENT_TYPE_JSON
      },
      body,
      credentials: "omit",
      redirect: "follow",
      referrer: "client"
    });

    let resp = await window.fetch(req);
    let bugzillaData = await resp.json();
    if (bugzillaData.error) {
      throw new Error(`Bugzilla request failed: ${bugzillaData.error.message}`);
    }
    let reviewTotal = bugzillaData.result.result.requestee.filter((f) => {
      return f.type == "review";
    }).length;

    let needinfoTotal = 0;
    if (settings.needinfos) {
      needinfoTotal = bugzillaData.result.result.requestee.filter((f) => {
        return f.type == "needinfo";
      }).length;
    }

    return { reviewTotal, needinfoTotal };
  }

  /**
   * Checks if Bugzilla service is configured (has API key).
   *
   * @param {Object} settings - Bugzilla service settings
   * @returns {boolean} True if API key is set
   */
  isConfigured(settings) {
    return !!settings.apiKey;
  }

  /**
   * Returns the Bugzilla dashboard URL.
   *
   * @param {Object} settings - Bugzilla service settings
   * @returns {string} Dashboard URL
   */
  getDashboardUrl(settings) {
    return BUGZILLA_DASHBOARD;
  }

  /**
   * Returns the service type identifier.
   *
   * @returns {string} "bugzilla"
   */
  getType() {
    return SERVICE_TYPES.BUGZILLA;
  }
}
