import { BaseService } from "./base-service.mjs";
import {
  BUGZILLA_API,
  BUGZILLA_DASHBOARD,
  SERVICE_TYPES,
  HTTP_METHODS
} from "../constants.mjs";

/**
 * Service for fetching Bugzilla review and needinfo counts.
 * Uses the Bugzilla REST API to fetch flags requested from the user.
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

    // "requestee" returns the flags awaiting a response from this user.
    let url = new URL(BUGZILLA_API);
    url.searchParams.set("type", "requestee");

    let req = new Request(url, {
      method: HTTP_METHODS.GET,
      headers: {
        "X-BUGZILLA-API-KEY": apiKey
      },
      credentials: "omit",
      redirect: "follow",
      referrer: "client"
    });

    let resp = await window.fetch(req);
    if (!resp.ok) {
      throw new Error(
        `Bugzilla request failed (${resp.status}): ${await resp.text()}`
      );
    }

    let bugzillaData = await resp.json();
    if (bugzillaData.error) {
      throw new Error(`Bugzilla request failed: ${bugzillaData.message}`);
    }

    let reviewTotal = bugzillaData.result.requestee.filter((f) => {
      return f.type == "review";
    }).length;

    let needinfoTotal = 0;
    if (settings.needinfos) {
      needinfoTotal = bugzillaData.result.requestee.filter((f) => {
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
