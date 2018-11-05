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
      // For the folks who are upgrading to the very first version that
      // has the featureRev thing, let them see the feature notification.
      if (alertRev == FIRST_FEATURE_ALERT_REV) {
        console.debug("Hit the first feature alert rev!");
        featureRev = 0;
      } else {
        console.debug("Updating first timer to latest featureRev");
        featureRev = alertRev;
      }
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

    let { userKeys, } = await browser.storage.local.get("userKeys");
    this.userKeys = userKeys || {};

    // Delete the Phabricator API key if the user still has it around,
    // since we don't use this anymore in more recent versions.
    if (this.userKeys.phabricator) {
      console.log("Found an old Phabricator API key - clearing it.");
      delete this.userKeys.phabricator;
      await browser.storage.local.set({
        userKeys: this.userKeys,
      });
      console.log("Old Phabricator API key is cleared.");
    }

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
    delete this.userKeys;
    delete this.updateInterval;
    delete this.featureRev;
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
      if (changes.userKeys) {
        this.userKeys = changes.userKeys.newValue;
        console.log("background.js saw change to userKeys");
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
    case "refresh": {
      this.updateBadge();
      break;
    }

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

  async githubReviewRequests(username) {
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

    let reviews = 0;

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
        reviews += this.reviewTotals.phabricator;
        console.log(`Found ${this.reviewTotals.phabricator} Phabricator reviews to do`);
      } catch (e) {
        // It would be nice to surface this to the user more directly.
        console.error("Error when fetching phabricator issues:", e);
      }
    } else {
      console.log("No Phabricator session found. I won't try to fetch anything for it.");
    }

    // Okay, now Bugzilla's turn...
    if (this.userKeys.bugzilla) {
      // I'm not sure how much of this is necessary - I just looked at what
      // the Bugzilla My Dashboard thing does in the network inspector, and
      // I'm more or less mimicking that here.
      let body = JSON.stringify({
        id: 4,
        method: "MyDashboard.run_flag_query",
        params: {
          Bugzilla_api_key: this.userKeys.bugzilla,
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
        console.error("Failed to get Bugzilla reviews: ",
          bugzillaData.error.message);
      } else {
        this.reviewTotals.bugzilla =
          bugzillaData.result.result.requestee.filter(f => {
            return f.type == "review";
          }).length;
        console.log(`Found ${this.reviewTotals.bugzilla} ` +
                    "Bugzilla reviews to do");
        reviews += this.reviewTotals.bugzilla;
      }
    }

    // Now, check github.
    if (this.userKeys.ghuser) {
      try {
        this.reviewTotals.github =
          await this.githubReviewRequests(this.userKeys.ghuser);
        reviews += this.reviewTotals.github;
        console.log(`Found ${this.reviewTotals.github} Github reviews to do`);
      } catch (e) {
        // It would be nice to surface this to the user more directly.
        console.error("Error when fetching github issues:", e);
      }
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
