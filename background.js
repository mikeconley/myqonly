const PHAB_ROOT = "https://phabricator.services.mozilla.com/api";
const PHAB_REVISIONS = "differential.revision.search";
const PHAB_WHOAMI = "user.whoami"
const BUGZILLA_API = "https://bugzilla.mozilla.org/jsonrpc.cgi";
const DEFAULT_UPDATE_INTERVAL = 5; // minutes

const MyQOnly = {
  async init() {
    browser.storage.onChanged.addListener(this.onStorageChanged.bind(this));
    browser.alarms.onAlarm.addListener(this.onAlarm.bind(this));
    browser.runtime.onMessage.addListener(this.onMessage.bind(this));

    let { updateInterval } = await browser.storage.local.get("updateInterval");
    if (!updateInterval) {
      await browser.storage.local.set({ updateInterval: DEFAULT_UPDATE_INTERVAL });
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

  onStorageChanged(changes, area) {
    if (area == "local") {
      if (changes.updateInterval) {
        this.updateInterval = changes.updateInterval.newValue;
        console.log(`background.js saw change to updateInterval: ${this.updateInterval}`);
        this.resetAlarm();
      }

      if (changes.userKeys) {
        this.userKeys = changes.userKeys.newValue;
        console.log("background.js saw change to userKeys");
        this.keysUpdated().then(() => {
          this.updateBadge();
        });
      }
    }
  },

  async keysUpdated() {
    this.phabricatorID = null;

    if (this.userKeys.phabricator) {
      // Now we need to get our Phabricator ID...
      this.phabricatorID = await this.getPhabricatorID();
      if (!this.phabricatorID) {
        console.error("Phailed to get Phabricator ID... :(");
      }
    }
  },

  ALARM_NAME: "check-for-updates",
  async resetAlarm() {
    let cleared = await browser.alarms.clear(this.ALARM_NAME);
    if (cleared) {
      console.log("Cleared old alarm");
    }

    console.log(`Resetting alarm - will fire in ${this.updateInterval} minutes`);
    browser.alarms.create(this.ALARM_NAME, {
      periodInMinutes: this.updateInterval,
    });
  },

  onMessage(message, sender, sendReply) {
    if (message.name == "get-reviews") {
      sendReply(this.reviewTotals);
    }
  },

  onAlarm(alarmInfo) {
    if (alarmInfo.name == this.ALARM_NAME) {
      console.log("Updating the badge now...");
      this.updateBadge();
    }
  },

  async updateBadge() {
    let reviews = 0;
    // First, let's get Phabricator...
    if (this.userKeys.phabricator) {
      let bodyParams = new URLSearchParams();
      bodyParams.append("__conduit__", `{"token": "${this.userKeys.phabricator}"}`);
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
        redirect: 'follow',
        referrer: 'client'
      });
      let resp = await window.fetch(req);
      let conduitData = await resp.json();
      this.reviewTotals.phabricator = conduitData.result.data.length;
      console.log(`Found ${this.reviewTotals.phabricator} Phabricator reviews to do`);
      reviews += this.reviewTotals.phabricator;
    }

    // Okay, now Bugzilla's turn...
    if (this.userKeys.bugzilla) {
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
        redirect: 'follow',
        referrer: 'client'
      });
      let resp = await window.fetch(req);
      let bugzillaData = await resp.json();
      this.reviewTotals.bugzilla = bugzillaData.result.result.requestee.filter(f => {
        return f.type == "review"
      }).length;
      console.log(`Found ${this.reviewTotals.bugzilla} Bugzilla reviews to do`);
      reviews += this.reviewTotals.bugzilla;
    }

    console.log(`Found a total of ${reviews} reviews to do`)
    if (!reviews) {
      browser.browserAction.setBadgeText({ text: null });
    } else {
      browser.browserAction.setBadgeText({ text: String(reviews) });
    }
  },

  async getPhabricatorID() {
    let params = new URLSearchParams();
    params.append("api.token", this.userKeys.phabricator);
    let url = [PHAB_ROOT, PHAB_WHOAMI].join("/") + "?" + params.toString();
    let req = new Request(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
      },
      redirect: 'follow',
      referrer: 'client'
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