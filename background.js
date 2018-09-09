const PHAB_ROOT = "https://phabricator.services.mozilla.com/api";
const PHAB_REVISIONS = "differential.revision.search";
const PHAB_WHOAMI = "user.whoami"
const BUGZILLA_API = "https://bugzilla.mozilla.org/jsonrpc.cgi";
const DEFAULT_UPDATE_INTERVAL = 5; // minutes
const ALARM_NAME = "check-for-updates";

const MyQOnly = {
  /**
   * Main entry. After set-up, attempts to update the badge right
   * away.
   */
  async init() {
    // Add a listener so that if our options change, we react to it.
    browser.storage.onChanged.addListener(this.onStorageChanged.bind(this));
    // Hook up our timer
    browser.alarms.onAlarm.addListener(this.onAlarm.bind(this));
    // Add a listener for the popup if it asks for review totals.
    browser.runtime.onMessage.addListener(this.onMessage.bind(this));

    let { updateInterval } = await browser.storage.local.get("updateInterval");
    if (!updateInterval) {
      await browser.storage.local.set({
        updateInterval: DEFAULT_UPDATE_INTERVAL
      });
    }
    this.updateInterval = updateInterval;

    let { userKeys } = await browser.storage.local.get("userKeys");
    this.userKeys = userKeys || {};

    this.reviewTotals = {
      bugzilla: 0,
      phabricator: 0,
    };

    await this.keysUpdated();
    await this.resetAlarm();
    await this.updateBadge();
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
        await this.keysUpdated();
        await this.updateBadge();
      }
    }
  },

  /**
   * Handles updating any internal state if the user updates
   * their API keys.
   */
  async keysUpdated() {
    if (this.userKeys.phabricator) {
      // At least in Phabricators case, this means that our
      // Phabricator user ID might no longer be the right one,
      // so let's wipe out that state.
      this.phabricatorID = null;
      // Now we need to get our Phabricator ID...
      this.phabricatorID = await this.getPhabricatorID();
      if (!this.phabricatorID) {
        console.error("Phailed to get Phabricator ID... :(");
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
    if (message.name == "get-reviews") {
      // The popup wants to know how many reviews there are to do.
      sendReply(this.reviewTotals);
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

  /**
   * Contacts Phabricator and Bugzilla (if the API keys for them exist),
   * and attempts to get a review count for each.
   */
  async updateBadge() {
    let reviews = 0;

    // First, let's get Phabricator...
    if (this.userKeys.phabricator) {
      // Believe it or not, this is how we need to get the reviews list via
      // the Conduit API. This was trickier to figure out than you'd think -
      // I ended up sniffing packets from the arc command line client to figure
      // out exactly what to send and how.
      let bodyParams = new URLSearchParams();
      bodyParams.append("__conduit__",
                        `{"token": "${this.userKeys.phabricator}"}`);
      let params = {
        "__conduit__": {
          token: this.userKeys.phabricator,
        },
        queryKey: "active",
        constraints: {
          reviewerPHIDs: [
            this.phabricatorID,
          ],
          statuses: [
            "needs-review",
          ]
        }
      };
      bodyParams.append("params", JSON.stringify(params));
      bodyParams.append("output", "json");
      bodyParams.append("__conduit__", true);

      let req = new Request([PHAB_ROOT, PHAB_REVISIONS].join("/"), {
        method: "POST",
        body: bodyParams,
        credentials: "omit",
        redirect: "follow",
        referrer: "client"
      });

      let resp = await window.fetch(req);
      let conduitData = await resp.json();

      if (conduitData.error_code) {
        console.error("Failed to get Phabricator reviews: ",
                      conduitData.error_info);
      } else {
        this.reviewTotals.phabricator = conduitData.result.data.length;
        console.log(`Found ${this.reviewTotals.phabricator} ` +
                    "Phabricator reviews to do");
        reviews += this.reviewTotals.phabricator;
      }
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
        referrer: "client"
      });

      let resp = await window.fetch(req);
      let bugzillaData = await resp.json();
      if (bugzillaData.error) {
        console.error("Failed to get Bugzilla reviews: ",
                      bugzillaData.error.message);
      } else {
        this.reviewTotals.bugzilla =
          bugzillaData.result.result.requestee.filter(f => {
            return f.type == "review"
          }).length;
        console.log(`Found ${this.reviewTotals.bugzilla} ` +
                    "Bugzilla reviews to do");
        reviews += this.reviewTotals.bugzilla;
      }
    }

    console.log(`Found a total of ${reviews} reviews to do`)
    if (!reviews) {
      browser.browserAction.setBadgeText({ text: null });
    } else {
      browser.browserAction.setBadgeText({ text: String(reviews) });
    }
  },

  /**
   * Gets and returns the Phabricator user ID for the user associated with the
   * Phabricator API token.
   */
  async getPhabricatorID() {
    let params = new URLSearchParams();
    params.append("api.token", this.userKeys.phabricator);

    let url = [PHAB_ROOT, PHAB_WHOAMI].join("/") + "?" + params.toString();
    let req = new Request(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
      },
      redirect: "follow",
      referrer: "client",
      credentials: "omit",
    });

    let resp = await fetch(req);
    let data = await resp.json();

    if (data.error_code) {
      console.error("Phabricator API error:", data.error_info);
    } else {
      console.log(`Got Phabricator ID: ${data.result.phid}`);
      return data.result.phid;
    }
  }
};

MyQOnly.init();