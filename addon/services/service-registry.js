/* eslint-disable no-unused-vars, no-redeclare */

/**
 * Service registry for managing review service instances.
 * Provides a factory method to create service instances based on type.
 */
class ServiceRegistry {
  constructor() {
    this.#services = new Map();
    this.#registerDefaultServices();
  }

  /**
   * Service instances cache, keyed by service type.
   * @type {Map<string, BaseService>}
   */
  #services;

  /**
   * Registers the built-in review services.
   */
  #registerDefaultServices() {
    this.register(SERVICE_TYPES.PHABRICATOR, new PhabricatorService());
    this.register(SERVICE_TYPES.BUGZILLA, new BugzillaService());
    this.register(SERVICE_TYPES.GITHUB, new GitHubService());
  }

  /**
   * Registers a service instance for a given type.
   *
   * @param {string} type - Service type identifier
   * @param {BaseService} serviceInstance - Service instance
   */
  register(type, serviceInstance) {
    this.#services.set(type, serviceInstance);
  }

  /**
   * Gets a service instance for the given type.
   *
   * @param {string} type - Service type identifier
   * @returns {BaseService|null} Service instance or null if not found
   */
  getService(type) {
    return this.#services.get(type) || null;
  }

  /**
   * Checks if a service type is registered.
   *
   * @param {string} type - Service type identifier
   * @returns {boolean} True if service is registered
   */
  hasService(type) {
    return this.#services.has(type);
  }

  /**
   * Gets all registered service types.
   *
   * @returns {string[]} Array of service type identifiers
   */
  getServiceTypes() {
    return Array.from(this.#services.keys());
  }
}
