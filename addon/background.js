// If we're running in the sinon-chrome test framework, we need to alias
// the chrome namespace to browser.
if (typeof browser == "undefined") {
  // eslint-disable-next-line no-redeclare
  var browser = chrome;
}

var MyQOnly = {
  /**
   * Initializes the MyQOnly extension by setting up listeners, loading stored
   * settings, and performing the initial badge update.
   *
   * @param {Object} options - Initialization options
   * @param {number} options.alertRev - Feature alert revision number to check
   * @returns {Promise<void>}
   */
  async init({ alertRev = FEATURE_ALERT_REV } = {}) {
    // Initialize service registry
    this.serviceRegistry = new ServiceRegistry();

    // Add a listener so that if our options change, we react to it.
    browser.storage.onChanged.addListener(this.onStorageChanged.bind(this));
    // Hook up our timer
    browser.alarms.onAlarm.addListener(this.onAlarm.bind(this));
    // Add a listener for the popup if it asks for review totals.
    browser.runtime.onMessage.addListener(this.onMessage.bind(this));

    console.debug("Looking for feature rev");
    let { featureRev } = await browser.storage.local.get(
      STORAGE_KEYS.FEATURE_REV
    );
    if (!featureRev) {
      console.debug("No feature rev - this is a first timer.");
      featureRev = alertRev;
      await browser.storage.local.set({ featureRev });
    } else {
      console.debug("Got feature rev ", featureRev);
    }

    this.featureRev = featureRev;

    let { updateInterval } = await browser.storage.local.get(
      STORAGE_KEYS.UPDATE_INTERVAL
    );
    if (!updateInterval) {
      updateInterval = DEFAULT_UPDATE_INTERVAL;
      await browser.storage.local.set({
        updateInterval
      });
    }
    this.updateInterval = updateInterval;

    this.states = new Map();

    let { services } = await browser.storage.local.get(STORAGE_KEYS.SERVICES);

    this.services = services || [];
    await this._initServices();
    await this.resetAlarm();
    await this.updateBadge();
  },

  /**
   * Cleans up the extension state. Used primarily for testing.
   */
  uninit() {
    delete this.states;
    delete this.services;
    delete this.updateInterval;
    delete this.featureRev;
    this._nextServiceID = 0;
  },

  /**
   * The following functions for manipulating services are for adding
   * defaults at initialization. Most service manipulation should really
   * be done by the user in the Options interface.
   */
  _nextServiceID: 0,

  /**
   * Initializes service configurations by creating state entries for existing
   * services, ensuring Phabricator service exists with defaults, and checking
   * for GitHub migration needs.
   *
   * @returns {Promise<void>}
   */
  async _initServices() {
    let maxServiceID = this._nextServiceID;
    for (let service of this.services) {
      this.states.set(service.id, {
        type: service.type,
        data: {}
      });
      maxServiceID = Math.max(service.id, maxServiceID);
    }
    this._nextServiceID = maxServiceID + 1;

    // Introduce a new default service configuration for Phabricator.
    let phabService = this._getService(SERVICE_TYPES.PHABRICATOR);
    if (!phabService) {
      await this._addService(SERVICE_TYPES.PHABRICATOR, {
        container: 0,
        inclReviewerGroups: true
      });
    } else if (phabService.settings.inclReviewerGroups === undefined) {
      phabService.settings.inclReviewerGroups = true;
      await browser.storage.local.set({ services: this.services });
    }

    let githubService = this._getService(SERVICE_TYPES.GITHUB);
    if (githubService) {
      await this._checkGitHubMigration(githubService);
    }
  },

  /**
   * Finds and returns a service by its type.
   *
   * @param {string} serviceType - Service type (e.g., "phabricator", "bugzilla", "github")
   * @returns {Object|null} Service object if found, null otherwise
   */
  _getService(serviceType) {
    for (let service of this.services) {
      if (service.type == serviceType) {
        return service;
      }
    }
    return null;
  },

  /**
   * Creates and adds a new service to the services list, then persists
   * it to storage. Assigns a unique ID to the service.
   *
   * @param {string} serviceType - Service type (e.g., "phabricator", "bugzilla", "github")
   * @param {Object} settings - Service-specific settings object
   * @returns {Promise<void>}
   */
  async _addService(serviceType, settings) {
    let newService = {
      id: this._nextServiceID,
      type: serviceType,
      settings
    };

    this._nextServiceID++;

    this.services.push(newService);

    await browser.storage.local.set({ services: this.services });
    this._ensureStatesForServices();
  },

  /**
   * Ensures that all services in the services list have corresponding state
   * entries in the states Map. Creates empty state objects for any missing services.
   */
  _ensureStatesForServices() {
    for (let service of this.services) {
      if (!this.states.has(service.id)) {
        this.states.set(service.id, {
          type: service.type,
          data: {}
        });
      }
    }
  },

  /**
   * Checks if a GitHub service has ignored repos in the old format (without
   * owner prefix) and flags them for migration if needed. Sets needsGitHubMigration
   * flag in storage if migration is required.
   *
   * @param {Object} service - GitHub service object
   * @returns {Promise<void>}
   */
  async _checkGitHubMigration(service) {
    let { needsGitHubMigration } = await browser.storage.local.get(
      "needsGitHubMigration"
    );
    if (needsGitHubMigration) {
      return;
    }

    let repos = (service.settings.ignoredRepos || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Check if any repos don't match owner/repo format
    // (e.g., "mozilla/gecko-dev")
    let hasOldFormat = repos.some((repo) => !repo.match(/^[^/]+\/[^/]+$/));

    if (hasOldFormat) {
      await browser.storage.local.set({
        needsGitHubMigration: true,
        oldIgnoredRepos: service.settings.ignoredRepos
      });
    }
  },

  /**
   * Handles updates to browser.storage. Reacts to changes in update interval
   * and service configurations by resetting alarms and updating the badge.
   *
   * @param {Object} changes - Storage changes object from browser.storage.onChanged
   * @param {string} area - Storage area name (e.g., "local", "sync")
   * @returns {Promise<void>}
   */
  async onStorageChanged(changes, area) {
    if (area == "local") {
      // The user updated the update interval, so let's cancel the old
      // alarm and set up a new one.
      if (changes.updateInterval) {
        this.updateInterval = changes.updateInterval.newValue;
        console.log(
          "background.js saw change to updateInterval: " + this.updateInterval
        );
        this.resetAlarm();
      }

      // The user updated their API keys, so let's go update the badge.
      if (changes.services) {
        this.services = changes.services.newValue;
        console.log("background.js saw change to services");
        this._ensureStatesForServices();
        await this.updateBadge();
      }
    }
  },

  /**
   * Clears any existing alarm and creates a new one using the current
   * update interval.
   *
   * @returns {Promise<void>}
   */
  async resetAlarm() {
    let cleared = await browser.alarms.clear(ALARM_NAME);
    if (cleared) {
      console.log("Cleared old alarm");
    }

    console.log(
      "Resetting alarm - will fire in " + `${this.updateInterval} minutes`
    );
    browser.alarms.create(ALARM_NAME, {
      periodInMinutes: this.updateInterval
    });
  },

  /**
   * Handles runtime messages from the popup, options page, and debug page.
   * Supports: get-states, refresh, get-feature-rev, opened-release-notes,
   * check-for-phabricator-session, get-phabricator-html.
   *
   * @param {Object} message - Message object with a 'name' property
   * @param {Object} sender - Sender information from browser.runtime
   * @param {Function} sendReply - Callback to send a response
   * @returns {Promise|undefined} Promise for async responses, undefined otherwise
   */
  onMessage(message, sender, sendReply) {
    switch (message.name) {
      case "get-states": {
        // The popup wants to know how many things there are to do.
        sendReply(this.states);
        break;
      }

      case "refresh": {
        this.updateBadge();
        break;
      }

      case "get-feature-rev": {
        sendReply({
          newFeatures: this.featureRev < FEATURE_ALERT_REV,
          featureRev: this.featureRev + 1
        });
        break;
      }

      case "opened-release-notes": {
        this.featureRev = FEATURE_ALERT_REV;
        browser.storage.local.set({ featureRev: this.featureRev });
        this.updateBadge();
        break;
      }

      case "check-for-phabricator-session": {
        let phabService = this.serviceRegistry.getService(
          SERVICE_TYPES.PHABRICATOR
        );
        return phabService.hasSession();
      }

      // Debug stuff
      case "get-phabricator-html": {
        console.debug("Getting Phabricator dashboard body");
        let phabService = this.serviceRegistry.getService(
          SERVICE_TYPES.PHABRICATOR
        );
        return phabService.getDocumentBodyForDebug();
      }
    }
  },

  /**
   * Handles browser alarm events. Triggers a badge update when the periodic
   * alarm fires.
   *
   * @param {Object} alarmInfo - Alarm information from browser.alarms.onAlarm
   */
  onAlarm(alarmInfo) {
    if (alarmInfo.name == ALARM_NAME) {
      console.log("Updating the badge now...");
      this.updateBadge();
    }
  },

  /**
   * Checks if the current time is within the user-configured working hours.
   * If working hours are disabled, always returns true.
   *
   * @returns {Promise<boolean>} True if within working hours or if feature is disabled
   */
  async isWorkingHours() {
    console.log("Checking working hours.");

    let { workingHours } = await browser.storage.local.get("workingHours");

    if (typeof workingHours === "undefined" || !workingHours.enabled) {
      console.log("Working hours are not enabled");
      return true;
    }

    let currentTime = new Date();

    // It's possible for the start or end time to be an empty string, if the
    // html5 time input had one empty field when a date checkbox was changed.
    // The time input is kind of tricky to use; it's easy to overlook the
    // am/pm chooser. Also, some people may just want to set days of the week,
    // not times of day. In these cases, just skip the missing time check.
    if (!workingHours.startTime) {
      console.log("Start time not set. Skipping start time check.");
    } else {
      let startTime = new Date();
      let [startHours, startMinutes] = workingHours.startTime.split(":");
      startTime.setHours(startHours, startMinutes);
      if (currentTime < startTime) {
        console.log(
          `Current time (${currentTime.toLocaleTimeString()}) is ` +
            "earlier than start time " +
            `(${startTime.toLocaleTimeString()})`
        );
        return false;
      }
    }

    if (!workingHours.endTime) {
      console.log("End time not set. Skipping end time check.");
    } else {
      let endTime = new Date();
      let [endHours, endMinutes] = workingHours.endTime.split(":");
      endTime.setHours(endHours, endMinutes);
      if (currentTime > endTime) {
        console.log(
          `Current time (${currentTime.toLocaleTimeString()}) is ` +
            "later than end time " +
            `(${endTime.toLocaleTimeString()})`
        );
        return false;
      }
    }

    // Unlike the times, workingHours.days should never be false-y: the days are
    // set via checkboxes, and if they are all unchecked, it'll be an empty
    // array (which is truthy).
    const days = {
      0: "sunday",
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday",
      5: "friday",
      6: "saturday"
    };
    let currentDay = days[currentTime.getDay()];
    if (!workingHours.days.includes(currentDay)) {
      console.log(
        `Current day (${currentDay}) is not one of the working ` +
          `days (${workingHours.days.join(", ")})`
      );
      return false;
    }

    console.log("Current time is within the working hours");
    return true;
  },

  /**
   * Calculates the total badge count across all services. Sums up review
   * counts and, for Bugzilla services, includes needinfo counts.
   *
   * @param {Map} states - Map of service states
   * @returns {number} Total count of reviews and needinfos
   */
  _calculateBadgeTotal(states) {
    let total = 0;
    for (let [, state] of states) {
      total += state.data.reviewTotal || 0;

      if (state.type == "bugzilla") {
        total += state.data.needinfoTotal || 0;
      }
    }

    return total;
  },

  /**
   * Updates the browser action badge by polling all configured services
   * (Phabricator, Bugzilla, GitHub) for review counts. Respects working hours
   * settings and shows feature alerts when no reviews are pending.
   *
   * @returns {Promise<void>}
   */
  async updateBadge() {
    for (let service of this.services) {
      let state = this.states.get(service.id);
      let data = state.data;

      try {
        let serviceHandler = this.serviceRegistry.getService(service.type);
        if (!serviceHandler) {
          console.error(`No service handler found for type: ${service.type}`);
          continue;
        }

        data = await serviceHandler.update(service.settings);

        // Log service-specific results
        if (service.type === SERVICE_TYPES.PHABRICATOR) {
          console.log(
            `Found ${data.reviewTotal} user reviews, ` +
              `${data.groupReviewTotal} group reviews ` +
              "to do in Phabricator."
          );
          if (service.settings.inclReviewerGroups) {
            data.reviewTotal += data.groupReviewTotal;
          }
        } else if (service.type === SERVICE_TYPES.BUGZILLA) {
          console.log(`Found ${data.reviewTotal} Bugzilla reviews to do`);
          console.log(`Found ${data.needinfoTotal} Bugzilla needinfos to do`);
        } else if (service.type === SERVICE_TYPES.GITHUB) {
          console.log(`Found ${data.reviewTotal} GitHub reviews to do`);
        }
      } catch (e) {
        console.error(`Error when updating ${service.type}: `, e.toString());
      }

      state.data = data;
    }

    let workingHours = await this.isWorkingHours();
    if (!workingHours) {
      console.log("Current time is outside working hours. Hiding reviews.");
      browser.browserAction.setBadgeText({ text: null });
      return;
    }

    let thingsToDo = this._calculateBadgeTotal(this.states);

    console.log(`Found a total of ${thingsToDo} things to do`);
    if (!thingsToDo) {
      // Check to see if there are new features to notify the user about.
      // We intentionally only do this if there are new reviews to do.
      if (this.featureRev < FEATURE_ALERT_REV) {
        browser.browserAction.setBadgeBackgroundColor({
          color: FEATURE_ALERT_BG_COLOR
        });
        browser.browserAction.setBadgeText({ text: FEATURE_ALERT_STRING });
      } else {
        browser.browserAction.setBadgeText({ text: null });
      }
    } else {
      // If we happened to set the background colour when alerting about
      // new features, clear that out now.
      browser.browserAction.setBadgeBackgroundColor({
        color: null
      });
      browser.browserAction.setBadgeText({ text: String(thingsToDo) });
    }
  }
};

// Hackily detect the sinon-chrome test framework. If we're inside it,
// don't run init automatically.
if (!browser.flush) {
  MyQOnly.init();
}
