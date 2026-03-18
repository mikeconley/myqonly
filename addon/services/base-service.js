/* eslint-disable no-unused-vars, no-redeclare */

/**
 * Base class for all review services. Each service fetches review counts
 * from an external system (Phabricator, Bugzilla, GitHub, etc.) and returns
 * standardized data.
 *
 * Services should extend this class and implement the abstract methods.
 */
class BaseService {
  /**
   * Updates the review count by fetching data from the service.
   *
   * @param {Object} settings - Service-specific settings
   * @returns {Promise<Object>} Data object containing at minimum { reviewTotal: number }
   * @abstract
   */
  async update(settings) {
    throw new Error("Service must implement update() method");
  }

  /**
   * Checks if the service is properly configured with required settings.
   *
   * @param {Object} settings - Service-specific settings
   * @returns {boolean} True if service can be used, false otherwise
   */
  isConfigured(settings) {
    return true;
  }

  /**
   * Returns the dashboard URL for this service where users can view reviews.
   *
   * @param {Object} settings - Service-specific settings
   * @returns {string} Dashboard URL
   */
  getDashboardUrl(settings) {
    return "";
  }

  /**
   * Returns the service type identifier (e.g., "phabricator", "bugzilla", "github").
   *
   * @returns {string} Service type identifier
   */
  getType() {
    throw new Error("Service must implement getType() method");
  }
}
