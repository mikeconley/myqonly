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
    let initted = new CustomEvent("initted", { bubbles: true, });
    document.dispatchEvent(initted);
  },

  populateBugzilla(service) {
    let bugzillaSettings =
      document.querySelector(".service-settings[data-type='bugzilla']");

    let apiKey = bugzillaSettings.querySelector("[data-type='apiKey']");
    apiKey.value = service.settings.apiKey;
  },

  populateGitHub(service) {
    let githubSettings =
      document.querySelector(".service-settings[data-type='github']");

    let username = githubSettings.querySelector("[data-type='username']");
    username.value = service.settings.username;
  },

  onUpdateService(event, serviceType) {
    let changedSetting = event.target.dataset.setting;
    let newValue = event.target.value;

    // For now, there's only a single service instance per type.
    let settings = this.getServiceSettings(serviceType);
    settings[changedSetting] = newValue;

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
