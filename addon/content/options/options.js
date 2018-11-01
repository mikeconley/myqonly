const Options = {
  KEYS: [
    "bugzilla",
    "ghuser",
  ],

  async init() {
    console.log("Initting Options page");

    console.debug("Getting update interval");
    let { updateInterval, } = await browser.storage.local.get("updateInterval");
    let interval = document.getElementById("update-interval");
    interval.value = updateInterval;

    console.debug("Getting userKeys");
    let { userKeys, } = await browser.storage.local.get("userKeys");
    this.userKeys = userKeys || {};
    console.debug("Updating keys in form");
    for (let keyType of this.KEYS) {
      if (this.userKeys[keyType]) {
        let el = document.querySelector(`[data-type=${keyType}]`);
        el.value = this.userKeys[keyType];
      }
    }

    console.debug("Adding change event listener");
    window.addEventListener("change", this);
    window.addEventListener("click", this);

    this.initWorkingHours();
    let initted = new CustomEvent("initted", { bubbles: true, });
    document.dispatchEvent(initted);
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
    if (event.target.id == "update-interval") {
      let updateInterval = parseInt(event.target.value, 10);
      browser.storage.local.set({ "updateInterval": updateInterval, }).then(() => {
        console.log(`Saved update interval as ${updateInterval} minutes`);
      });
    } else if (event.target.type == "text") {
      let keyType = event.target.dataset.type;
      this.userKeys[keyType] = event.target.value;
      browser.storage.local.set({ "userKeys": this.userKeys, }).then(() => {
        console.log(`Saved update to key type ${keyType}`);
      });
    } else if (event.target.closest("#working-hours-fields")) {
      this.onWorkingHoursChanged();
    }
  },

  onWorkingHoursChanged() {
    console.log("Working hours changed");

    let enabled = document.querySelector("#working-hours-checkbox").checked;
    if (enabled) {
      document.querySelector("#working-hours-fields").removeAttribute("disabled");
    } else {
      document.querySelector("#working-hours-fields").setAttribute("disabled", "disabled");
    }

    // Times are strings of the form "HH:MM" in 24-hour format (or empty string)
    let startTime = document.querySelector("#start-time").value;
    let endTime = document.querySelector("#end-time").value;

    // `days` is an array containing en-US day strings: ['sunday', 'monday', ...]
    let days = [].slice.call(document.querySelectorAll(".days > input:checked"))
      .map(el => { return el.getAttribute("id");});

    browser.storage.local.set({ workingHours: {enabled, days, startTime, endTime,},}).then(() => {
      console.log(`Saved update to working hours: enabled: ${enabled}, days: ${days.join(",")}, start time: ${startTime}, end time: ${endTime}`);
    }).catch((err) => {
      console.error(`Error updating working hours: ${err}`);
    });
  },
};

addEventListener("DOMContentLoaded", () => {
  Options.init();
}, { once: true, });
