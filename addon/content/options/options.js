const Options = {
  _nextID: 0,

  async init() {
    console.log("Initting Options page");

    console.debug("Getting update interval");
    let { updateInterval, } = await browser.storage.local.get("updateInterval");
    let interval = document.getElementById("update-interval");
    interval.value = updateInterval;

    console.debug("Getting services");
    let { services, } = await browser.storage.local.get("services");
    this.services = services || [];

    console.debug("Populating form");
    for (let service of this.services) {
      switch (service.type) {
      case "phabricator": {
        this.populatePhabricator(service);
        break;
      }
      case "bugzilla": {
        this.populateBugzilla(service);
        break;
      }
      case "github": {
        this.populateGitHub(service);
        break;
      }
      }
      this._nextID = Math.max(this._nextID, service.id);
    }

    this._nextID++;

    console.debug("Adding change event listener");
    window.addEventListener("change", this);
    window.addEventListener("click", this);

    this.initWorkingHours();
    await this.checkMigrationNeeded();
    let initted = new CustomEvent("initted", { bubbles: true, });
    document.dispatchEvent(initted);
  },

  populatePhabricator(service) {
    let phabricatorSettings =
      document.querySelector(".service-settings[data-type='phabricator']");

    let container =
      phabricatorSettings.querySelector("[data-setting='container']");
    container.checked = !!service.settings.container;

    let inclReviewerGroups =
      phabricatorSettings.querySelector("[data-setting='inclReviewerGroups']");
    inclReviewerGroups.checked = !!service.settings.inclReviewerGroups;

    let sessionPromise =
      browser.runtime.sendMessage({ name: "check-for-phabricator-session", });
    sessionPromise.then(hasSession => {
      let status = document.getElementById("phabricator-session-status");
      status.setAttribute("has-session", hasSession);
    });
  },

  populateBugzilla(service) {
    let bugzillaSettings =
      document.querySelector(".service-settings[data-type='bugzilla']");

    let apiKey = bugzillaSettings.querySelector("[data-setting='apiKey']");
    apiKey.value = service.settings.apiKey;

    let needinfos =
      bugzillaSettings.querySelector("[data-setting='needinfos']");
    needinfos.checked = !!service.settings.needinfos;
  },

  populateGitHub(service) {
    let githubSettings =
      document.querySelector(".service-settings[data-type='github']");

    let username = githubSettings.querySelector("[data-setting='username']");
    username.value = service.settings.username;

    let token = githubSettings.querySelector("[data-setting='token']");
    token.value = service.settings.token || "";

    let ignoreOwnPrs =
      githubSettings.querySelector("[data-setting='ignoreOwnPrs']");
    ignoreOwnPrs.checked = !!service.settings.ignoreOwnPrs;

    let ignoreDraftPrs =
      githubSettings.querySelector("[data-setting='ignoreDraftPrs']");
    ignoreDraftPrs.checked = !!service.settings.ignoreDraftPrs;

    let ignoredUsers =
      githubSettings.querySelector("[data-setting='ignoredUsers']");
    ignoredUsers.value = service.settings.ignoredUsers || "";

    let ignoredTeams =
      githubSettings.querySelector("[data-setting='ignoredTeams']");
    ignoredTeams.value = service.settings.ignoredTeams || "";

    let ignoredRepos =
      githubSettings.querySelector("[data-setting='ignoredRepos']");
    ignoredRepos.value = service.settings.ignoredRepos || "";
  },

  onUpdateService(event, serviceType) {
    let changedSetting = event.target.dataset.setting;
    let newValue;
    switch (event.target.type) {
    case "text":
    case "password":
      newValue = event.target.value;
      break;
    case "checkbox":
      if (event.target.checked) {
        if (event.target.hasAttribute("value")) {
          newValue = event.target.value;
        } else {
          newValue = true;
        }
      } else {
        newValue = null;
      }
      break;
    }

    // For now, there's only a single service instance per type.
    let settings = this.getServiceSettings(serviceType);
    if (newValue !== undefined) {
      settings[changedSetting] = newValue;
    } else {
      delete settings[changedSetting];
    }

    browser.storage.local.set({ "services": this.services, }).then(() => {
      console.log(`Saved update to ${serviceType} setting ${changedSetting}`);
    });
  },

  getServiceSettings(serviceType) {
    for (let instance of this.services) {
      if (instance.type == serviceType) {
        return instance.settings;
      }
    }

    let settings = {};
    // We've never saved a value here before. Let's create a new one.
    this.services.push({
      id: this._nextID++,
      type: serviceType,
      settings,
    });

    return settings;
  },

  async checkMigrationNeeded() {
    let { needsGitHubMigration, oldIgnoredRepos } =
      await browser.storage.local.get(["needsGitHubMigration", "oldIgnoredRepos"]);

    if (needsGitHubMigration) {
      let warningDiv = document.getElementById("github-migration-warning");
      warningDiv.classList.remove("hidden");
      document.getElementById("old-repos").textContent = oldIgnoredRepos;
    }
  },

  async showMigrationHelper() {
    let githubService = this.services.find(s => s.type === "github");

    if (!githubService || !githubService.settings.username) {
      alert("Please configure your GitHub username first.");
      return;
    }

    let username = githubService.settings.username;
    let token = githubService.settings.token;

    let query = `is:pr is:open review-requested:${username}`;
    let url = new URL("https://api.github.com/search/issues");
    url.searchParams.set("q", query);
    url.searchParams.set("per_page", "100");

    let headers = {
      Accept: "application/vnd.github.v3+json",
    };
    if (token) {
      headers["Authorization"] = `token ${token}`;
    }

    try {
      let response = await fetch(url, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`GitHub request failed: ${response.status}`);
      }

      let data = await response.json();

      let repos = new Set();
      for (let item of data.items) {
        let match = item.repository_url.match(/\/repos\/([^/]+\/[^/]+)/);
        if (match) {
          repos.add(match[1]);
        }
      }

      this.showRepoSelectionDialog(Array.from(repos));
    } catch (error) {
      console.error("Failed to fetch GitHub repositories:", error);
      alert(`Failed to fetch your GitHub review requests: ${error.message}`);
    }
  },

  showRepoSelectionDialog(repos) {
    let template = document.getElementById("migration-dialog-template");
    let dialogNode = template.content.cloneNode(true);
    let dialog = dialogNode.querySelector("dialog");

    let repoList = dialog.querySelector("#repo-list");
    repoList.innerHTML = "";
    for (let repo of repos) {
      let label = document.createElement("label");
      label.className = "repo-item";
      let checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = repo;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" " + repo));
      repoList.appendChild(label);
    }

    document.body.appendChild(dialog);
    dialog.showModal();
  },

  async onSaveMigration(event) {
    let dialog = event.target.closest("dialog");
    let selected = Array.from(dialog.querySelectorAll("input:checked"))
      .map(cb => cb.value);

    document.getElementById("github-ignored-repos").value = selected.join(", ");

    let changeEvent = new Event("change", { bubbles: true, });
    document.getElementById("github-ignored-repos").dispatchEvent(changeEvent);

    await browser.storage.local.remove(["needsGitHubMigration", "oldIgnoredRepos"]);

    dialog.close();
    document.body.removeChild(dialog);
    document.getElementById("github-migration-warning").classList.add("hidden");
  },

  onCancelMigration(event) {
    let dialog = event.target.closest("dialog");
    dialog.close();
    document.body.removeChild(dialog);
  },

  async initWorkingHours() {
    // Specify reasonable defaults for the first-run case.
    let { workingHours, } = await browser.storage.local.get({workingHours: {
      enabled: false,
      startTime: "09:00",
      endTime: "17:00",
      days: ["monday","tuesday","wednesday","thursday","friday",],
    },});

    let workingHoursSection = document.querySelector("#working-hours");
    let fields = workingHoursSection.querySelector("#working-hours-fields");
    workingHoursSection.querySelector("#working-hours-checkbox").checked =
      workingHours.enabled;

    if (workingHours.enabled) {
      fields.removeAttribute("disabled");
    } else {
      fields.setAttribute("disabled", "disabled");
    }

    document.querySelector("#start-time").value  = workingHours.startTime;
    document.querySelector("#end-time").value    = workingHours.endTime;

    let dayEls = fields.querySelectorAll(".days > input[type='checkbox']");
    for (let dayEl of dayEls) {
      dayEl.checked = workingHours.days.includes(dayEl.id);
    }
  },

  handleEvent(event) {
    switch (event.type) {
    case "click": {
      return this.onClick(event);
    }
    case "change": {
      return this.onChange(event);
    }
    }
  },

  onClick(event) {
    switch (event.target.id) {
    case "debug": {
      browser.tabs.create({
        url: event.target.href,
      });
      event.preventDefault();
      return false;
    }
    case "working-hours-checkbox": {
      this.onWorkingHoursChanged();
      break;
    }
    case "help-migrate": {
      this.showMigrationHelper();
      break;
    }
    case "save-migration": {
      this.onSaveMigration(event);
      break;
    }
    case "cancel-migration": {
      this.onCancelMigration(event);
      break;
    }
    }
  },

  onChange(event) {
    // Are we updating a service?
    let serviceSettings = event.target.closest(".service-settings");
    if (serviceSettings) {
      return this.onUpdateService(event, serviceSettings.dataset.type);
    }

    if (event.target.id == "update-interval") {
      let updateInterval = parseInt(event.target.value, 10);
      browser.storage.local.set({ updateInterval, }).then(() => {
        console.log(`Saved update interval as ${updateInterval} minutes`);
      });
    } else if (event.target.closest("#working-hours-fields")) {
      this.onWorkingHoursChanged();
    }
  },

  onWorkingHoursChanged() {
    console.log("Working hours changed");

    let enabled = document.querySelector("#working-hours-checkbox").checked;
    if (enabled) {
      document.querySelector("#working-hours-fields")
        .removeAttribute("disabled");
    } else {
      document.querySelector("#working-hours-fields")
        .setAttribute("disabled", "disabled");
    }

    // Times are strings of the form "HH:MM" in 24-hour format (or empty string)
    let startTime = document.querySelector("#start-time").value;
    let endTime = document.querySelector("#end-time").value;

    // `days` is an array containing en-US day strings:
    // ['sunday', 'monday', ...]
    let days = [].slice.call(document.querySelectorAll(".days > input:checked"))
      .map(el => { return el.getAttribute("id");});

    browser.storage.local.set({
      workingHours: {
        enabled,
        days,
        startTime,
        endTime,
      },
    }).then(() => {
      console.log(`Saved update to working hours: enabled: ${enabled}, ` +
                  `days: ${days.join(",")}, start time: ${startTime}, ` +
                  `end time: ${endTime}`);
    }).catch((err) => {
      console.error(`Error updating working hours: ${err}`);
    });
  },
};

addEventListener("DOMContentLoaded", () => {
  Options.init();
}, { once: true, });
