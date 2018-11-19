// If we're running in the sinon-chrome test framework, we need to alias
// the chrome namespace to browser.
if (typeof(browser) == "undefined") {
  var browser = chrome;
}

var MyQOnly = {
  /**
   * Main entry. After set-up, attempts to update the badge right
   * away.
   */
  async init({ alertRev = FEATURE_ALERT_REV, } = {}) {
    // Add a listener so that if our options change, we react to it.
    browser.storage.onChanged.addListener(this.onStorageChanged.bind(this));
    // Hook up our timer
    browser.alarms.onAlarm.addListener(this.onAlarm.bind(this));
    // Add a listener for the popup if it asks for review totals.
    browser.runtime.onMessage.addListener(this.onMessage.bind(this));

    console.debug("Looking for feature rev");
    let { featureRev, } = await browser.storage.local.get("featureRev");
    if (!featureRev) {
      console.debug("No feature rev - this is a first timer.");
      featureRev = alertRev;
      await browser.storage.local.set({ featureRev, });
    } else {
      console.debug("Got feature rev ", featureRev);
    }

    this.featureRev = featureRev;

    let { updateInterval, } = await browser.storage.local.get("updateInterval");
    if (!updateInterval) {
      updateInterval = DEFAULT_UPDATE_INTERVAL;
      await browser.storage.local.set({
        updateInterval,
      });
    }
    this.updateInterval = updateInterval;

    // Version 0.5.2 and earlier used a simpler schema for storing service
    // information. If we find the old storage schema, migrate it to the
    // new one.
    let { userKeys, } = await browser.storage.local.get("userKeys");
    if (userKeys) {
      await this.migrateUserKeysToServicesSchema(userKeys);
    }

    let { services, } = await browser.storage.local.get("services");
    this.services = services || [];

    this.reviewTotals = {
      bugzilla: 0,
      phabricator: 0,
      github: 0,
    };

    await this.resetAlarm();
    await this.updateBadge();
  },

  uninit() {
    delete this.reviewTotals;
    delete this.services;
    delete this.updateInterval;
    delete this.featureRev;
  },

  /**
   * Migrates the service storage schema from userKeys (from v0.5.2 and
   * earlier) to the service schema.
   *
   * The userKeys schema was a simple Object with the following optional
   * keys:
   *
   *  "phabricator" -> string:
   *    This was only stored at one time, very early on in MyQOnly's lifetime,
   *    before it started using page scraping, and used the Conduit API instead.
   *    The value was the Phabricator API key.
   *  "bugzilla" -> string:
   *    The Bugzilla API token for the user for querying for review flags.
   *  "ghuser" -> string:
   *    The GitHub username for the user for querying for open pull requests.
   *
   * The new services schema is an Array, where each element in the Array is
   * an Object with the following keys:
   *
   *  "id" -> int
   *    A unique ID for the service instance.
   *  "type" -> string
   *    A string describing the type of service. Example: "phabricator", "bugzilla"
   *  "settings" -> Object
   *    A set of service-specific options.
   */
  async migrateUserKeysToServicesSchema(userKeys) {
    let services = [];
    let id = 1;

    for (let oldKey in userKeys) {
      let oldValue = userKeys[oldKey];
      switch (oldKey) {
      case "bugzilla": {
        services.push({
          id,
          type: "bugzilla",
          settings: {
            apiKey: oldValue,
          },
        });
        break;
      }
      case "ghuser": {
        services.push({
          id,
          type: "github",
          settings: {
            username: oldValue,
          },
        });
        break;
      }
      }
      id++;
    }

    // Save the new schema, and move the userKeys object into temporary
    // storage. We'll remove it in a later version.
    await browser.storage.local.set({
      services,
      userKeys: null,
      oldUserKeys: userKeys,
    });
  },

  /**
   * Handles updates to the user options.
   */
  async onStorageChanged(changes, area) {
    if (area == "local") {
      // The user updated the update interval, so let's cancel the old
      // alarm and set up a new one.
      if (changes.updateInterval) {
        this.updateInterval = changes.updateInterval.newValue;
        console.log("background.js saw change to updateInterval: " +
                    this.updateInterval);
        this.resetAlarm();
      }

      // The user updated their API keys, so let's go update the badge.
      if (changes.services) {
        this.services = changes.services.newValue;
        console.log("background.js saw change to services");
        await this.updateBadge();
      }
    }
  },

  /**
   * Wipes out any pre-existing alarm and sets up a new one with
   * the current update interval.
   */
  async resetAlarm() {
    let cleared = await browser.alarms.clear(ALARM_NAME);
    if (cleared) {
      console.log("Cleared old alarm");
    }

    console.log("Resetting alarm - will fire in " +
                `${this.updateInterval} minutes`);
    browser.alarms.create(ALARM_NAME, {
      periodInMinutes: this.updateInterval,
    });
  },

  /**
   * Handles messages from the popup.
   */
  onMessage(message, sender, sendReply) {
    switch (message.name) {
    case "get-reviews": {
      // The popup wants to know how many reviews there are to do.
      sendReply(this.reviewTotals);
      break;
    }

    case "refresh": {
      this.updateBadge();
      break;
    }

    case "get-feature-rev": {
      sendReply({
        newFeatures: this.featureRev < FEATURE_ALERT_REV,
        featureRev: this.featureRev + 1,
      });
      break;
    }

    case "opened-release-notes": {
      this.featureRev = FEATURE_ALERT_REV;
      browser.storage.local.set({ featureRev: this.featureRev, });
      this.updateBadge();
      break;
    }

    // Debug stuff
    case "get-phabricator-html": {
      console.debug("Getting Phabricator dashboard body");
      return this._phabricatorDocumentBody();
    }
    }
  },

  /**
   * The alarm went off! Let's do the badge updating stuff now.
   */
  onAlarm(alarmInfo) {
    if (alarmInfo.name == ALARM_NAME) {
      console.log("Updating the badge now...");
      this.updateBadge();
    }
  },

  async _phabricatorDocumentBody({ testingURL = null, } = {}) {
    let url = testingURL || [PHABRICATOR_ROOT, PHABRICATOR_DASHBOARD,].join("/");

    let req = new Request(url, {
      method: "GET",
      headers: {
        "Content-Type": "text/html",
      },
      redirect: "follow",
    });

    let resp = await window.fetch(req);
    let pageBody = await resp.text();
    return pageBody;
  },

  async phabricatorReviewRequests({ testingURL = null, } = {}) {
    let pageBody = await this._phabricatorDocumentBody({ testingURL, });
    let parser = new DOMParser();
    let doc = parser.parseFromString(pageBody, "text/html");

    let headers = doc.querySelectorAll(".phui-header-header");
    let total = 0;

    for (let header of headers) {
      if (PHABRICATOR_REVIEW_HEADERS.includes(header.textContent)) {
        let box = header.closest(".phui-box");
        let rows = box.querySelectorAll(".phui-oi-table-row");
        total += rows.length;
      }
    }

    return total;
  },

  async updateBugzilla(settings) {
    let apiKey = settings.apiKey;
    // I'm not sure how much of this is necessary - I just looked at what
    // the Bugzilla My Dashboard thing does in the network inspector, and
    // I'm more or less mimicking that here.
    let body = JSON.stringify({
      id: 4,
      method: "MyDashboard.run_flag_query",
      params: {
        Bugzilla_api_key: apiKey,
        type: "requestee",
      },
      version: "1.1",
    });

    let req = new Request(BUGZILLA_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      credentials: "omit",
      redirect: "follow",
      referrer: "client",
    });

    let resp = await window.fetch(req);
    let bugzillaData = await resp.json();
    if (bugzillaData.error) {
      throw new Error(`Bugzilla request failed: ${bugzillaData.error.message}`);
    }
    let total =
      bugzillaData.result.result.requestee.filter(f => {
        return f.type == "review";
      }).length;
    return total;
  },

  async updateGitHub(settings) {
    let username = settings.username;
    // We don't seem to need authentication for this request, for whatever reason.
    let url = new URL(GITHUB_API);
    url.searchParams.set("q", `review-requested:${username} type:pr is:open archived:false`);
    // Note: we might need to paginate if we care about fetching more than the
    // first 100.
    let response = await window.fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
      // Probably doesn't matter.
      credentials: "omit",
    });
    if (!response.ok) {
      console.error("Failed to request from github", response);
      throw new Error(`Github request failed (${response.status}): ${await response.text()}`);
    }
    const data = await response.json();
    return data.total_count;
  },

  /**
   * Is the current time within the user's working hours (if enabled)?
   */
  async isWorkingHours() {
    console.log("Checking working hours.");

    let { workingHours, } = await browser.storage.local.get("workingHours");

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
      let [startHours, startMinutes,] = workingHours.startTime.split(":");
      startTime.setHours(startHours, startMinutes);
      if (currentTime < startTime) {
        console.log(`Current time (${currentTime.toLocaleTimeString()}) is earlier than start time (${startTime.toLocaleTimeString()})`);
        return false;
      }
    }

    if (!workingHours.endTime) {
      console.log("End time not set. Skipping end time check.");
    } else {
      let endTime = new Date();
      let [endHours, endMinutes,] = workingHours.endTime.split(":");
      endTime.setHours(endHours, endMinutes);
      if (currentTime > endTime) {
        console.log(`Current time (${currentTime.toLocaleTimeString()}) is later than end time (${endTime.toLocaleTimeString()})`);
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
      6: "saturday",
    };
    let currentDay = days[currentTime.getDay()];
    if (!workingHours.days.includes(currentDay)) {
      console.log(`Current day (${currentDay}) is not one of the working days (${workingHours.days.join(", ")})`);
      return false;
    }

    console.log("Current time is within the working hours");
    return true;
  },

  /**
   * Contacts Phabricator, Bugzilla, and Github (if the API keys for them exist),
   * and attempts to get a review count for each.
   */
  async updateBadge() {
    let workingHours = await this.isWorkingHours();
    if (!workingHours) {
      console.log("Current time is outside working hours. Hiding reviews.");
      browser.browserAction.setBadgeText({ text: null, });
      return;
    }

    // First, let's get Phabricator...
    // We'll start by seeing if we have any cookies.
    let phabCookie = await browser.cookies.get({
      url: PHABRICATOR_ROOT,
      name: "phsid",
    });

    if (phabCookie) {
      console.log("Phabricator session found! Attempting to get dashboard page.");

      try {
        this.reviewTotals.phabricator =
          await this.phabricatorReviewRequests();
        console.log(`Found ${this.reviewTotals.phabricator} Phabricator reviews to do`);
      } catch (e) {
        // It would be nice to surface this to the user more directly.
        console.error("Error when fetching phabricator issues:", e);
      }
    } else {
      console.log("No Phabricator session found. I won't try to fetch anything for it.");
    }

    for (let service of this.services) {
      try {
        switch (service.type) {
        case "bugzilla": {
          this.reviewTotals.bugzilla = await this.updateBugzilla(service.settings);
          console.log(`Found ${this.reviewTotals.bugzilla} Bugzilla reviews to do`);
          break;
        }
        case "github": {
          this.reviewTotals.github = await this.updateGitHub(service.settings);
          console.log(`Found ${this.reviewTotals.github} GitHub reviews to do`);
          break;
        }
        }
      } catch (e) {
        console.error(`Error when updating ${service.type}: `, e);
      }
    }

    let reviews = 0;
    for (let serviceReviewCount in this.reviewTotals) {
      reviews += this.reviewTotals[serviceReviewCount];
    }

    console.log(`Found a total of ${reviews} reviews to do`);
    if (!reviews) {
      // Check to see if there are new features to notify the user about.
      // We intentionally only do this if there are new reviews to do.
      if (this.featureRev < FEATURE_ALERT_REV) {
        browser.browserAction.setBadgeBackgroundColor({
          color: FEATURE_ALERT_BG_COLOR,
        });
        browser.browserAction.setBadgeText({ text: FEATURE_ALERT_STRING, });
      } else {
        browser.browserAction.setBadgeText({ text: null, });
      }
    } else {
      // If we happened to set the background colour when alerting about
      // new features, clear that out now.
      browser.browserAction.setBadgeBackgroundColor({
        color: null,
      });
      browser.browserAction.setBadgeText({ text: String(reviews), });
    }
  },
};

// Hackily detect the sinon-chrome test framework. If we're inside it,
// don't run init automatically.
if (!browser.flush) {
  MyQOnly.init();
}
