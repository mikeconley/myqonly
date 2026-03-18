/* eslint-disable no-unused-vars, no-redeclare */

/**
 * Service for fetching GitHub pull request review counts.
 * Uses the GitHub Search API to find PRs requesting review from the user,
 * with extensive filtering options.
 */
class GitHubService extends BaseService {
  /**
   * Updates GitHub pull request review counts using the GitHub Search API.
   * Filters by various criteria including ignored repos, users, teams, and PR types.
   *
   * @param {Object} settings - GitHub service settings
   * @param {string} settings.username - GitHub username
   * @param {string} [settings.token] - Optional GitHub personal access token
   * @param {string} [settings.ignoredRepos] - Comma-separated list of owner/repo to ignore
   * @param {string} [settings.ignoredUsers] - Comma-separated list of users to ignore
   * @param {string} [settings.ignoredTeams] - Comma-separated list of teams to ignore
   * @param {boolean} [settings.ignoreOwnPrs] - Ignore PRs authored by the user
   * @param {boolean} [settings.ignoreDraftPrs] - Ignore draft PRs
   * @returns {Promise<Object>} Object with reviewTotal and reviewUrl
   */
  async update(settings) {
    let username = settings.username;
    let reviewUrl = new URL(GITHUB_REVIEW_URL);

    if (!username) {
      return { reviewTotal: 0, reviewUrl: reviewUrl.toString() };
    }
    let token = settings.token;

    let ignoredRepos = (settings.ignoredRepos || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // We don't seem to need authentication for this request, for whatever
    // reason.
    let url = new URL(GITHUB_API);
    let query = `review-requested:${username} type:pr is:open archived:false`;
    if (settings.ignoreOwnPrs) {
      query += ` -author:${username}`;
    }
    let ignoredUsers = [
      ...new Set(
        (settings.ignoredUsers || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    ];
    if (ignoredUsers.length > 0) {
      query += ignoredUsers.map((u) => ` -author:${u}`).join(" ");
    }
    let ignoredTeams = [
      ...new Set(
        (settings.ignoredTeams || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    ];
    if (ignoredTeams.length > 0) {
      query += ignoredTeams
        .map((u) => ` -team-review-requested:${u}`)
        .join(" ");
    }
    if (settings.ignoreDraftPrs) {
      query += " draft:false";
    }
    for (let repo of ignoredRepos) {
      query += ` -repo:${repo}`;
    }
    url.searchParams.set("q", query);
    reviewUrl.searchParams.set("q", query);
    reviewUrl = reviewUrl.toString();

    let headers = {
      Accept: "application/vnd.github.v3+json"
    };
    if (token) {
      headers["Authorization"] = `token ${token}`;
    }
    const apiRequestOptions = {
      method: HTTP_METHODS.GET,
      headers: headers,
      // Probably doesn't matter.
      credentials: "omit"
    };
    // Note: we might need to paginate if we care about fetching more than the
    // first 100.
    let response = await window.fetch(url, apiRequestOptions);
    if (!response.ok) {
      console.error("Failed to request from github", response);
      throw new Error(
        `Github request failed (${response.status}): ` +
          `${await response.text()}`
      );
    }
    const data = await response.json();

    if (ignoredRepos.length === 0) {
      return { reviewTotal: data.total_count, reviewUrl };
    }

    // `items` may be a partial list. Ideally we'd paginate, but for now we just
    // assume everything in total_count that isn't part of items is important.
    let validPrs = data.total_count - data.items.length;
    for (let pr of data.items) {
      if (
        ignoredRepos.every((repo) => !pr.repository_url.endsWith(`/${repo}`))
      ) {
        validPrs++;
      }
    }
    return { reviewTotal: validPrs, reviewUrl };
  }

  /**
   * Checks if GitHub service is configured (has username).
   *
   * @param {Object} settings - GitHub service settings
   * @returns {boolean} True if username is set
   */
  isConfigured(settings) {
    return !!settings.username;
  }

  /**
   * Returns the GitHub review dashboard URL.
   *
   * @param {Object} settings - GitHub service settings
   * @returns {string} Dashboard URL
   */
  getDashboardUrl(settings) {
    return GITHUB_REVIEW_URL;
  }

  /**
   * Returns the service type identifier.
   *
   * @returns {string} "github"
   */
  getType() {
    return SERVICE_TYPES.GITHUB;
  }
}
