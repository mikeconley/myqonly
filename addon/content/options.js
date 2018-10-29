const Options = {
  KEYS: [
    "bugzilla",
    "ghuser"
  ],

  async init() {
    let { updateInterval } = await browser.storage.local.get("updateInterval");
    let interval = document.getElementById("update-interval");
    interval.value = updateInterval;

    let { userKeys } = await browser.storage.local.get("userKeys");
    this.userKeys = userKeys || {};
    for (let keyType of this.KEYS) {
      if (this.userKeys[keyType]) {
        let el = document.querySelector(`[data-type=${keyType}]`);
        el.value = this.userKeys[keyType];
      }
    }

    let options = document.getElementById("options");
    options.addEventListener("change", this);

    this.initWorkingHours();
  },

  async initWorkingHours() {
    // Specify reasonable defaults for the first-run case.
    let { workingHours } = await browser.storage.local.get({workingHours: {
      enabled: false,
      startTime: "09:00",
      endTime: "17:00",
      days: ["monday","tuesday","wednesday","thursday","friday"]
    }});

    document.querySelector("#working-hours-checkbox").checked = workingHours.enabled;
    if (workingHours.enabled) {
      document.querySelector("#working-hours").removeAttribute("disabled");
    } else {
      document.querySelector("#working-hours").setAttribute("disabled", "disabled");
    }
    document.querySelector("#start-time").value  = workingHours.startTime;
    document.querySelector("#end-time").value    = workingHours.endTime;
    document.querySelector("#sunday").checked    = workingHours.days.includes("sunday");
    document.querySelector("#monday").checked    = workingHours.days.includes("monday");
    document.querySelector("#tuesday").checked   = workingHours.days.includes("tuesday");
    document.querySelector("#wednesday").checked = workingHours.days.includes("wednesday");
    document.querySelector("#thursday").checked  = workingHours.days.includes("thursday");
    document.querySelector("#friday").checked    = workingHours.days.includes("friday");
    document.querySelector("#saturday").checked  = workingHours.days.includes("saturday");
  },

  handleEvent(e) {
    if (e.target.id == "update-interval") {
      let updateInterval = parseInt(e.target.value, 10);
      browser.storage.local.set({ "updateInterval": updateInterval }).then(() => {
        console.log(`Saved update interval as ${updateInterval} minutes`);
      });
    } else if (e.target.type == "text") {
      let keyType = e.target.dataset.type;
      this.userKeys[keyType] = e.target.value;
      browser.storage.local.set({ "userKeys": this.userKeys }).then(() => {
        console.log(`Saved update to key type ${keyType}`);;
      });
    } else if (e.target.id == "working-hours-checkbox" || e.target.closest("#working-hours")) {
      this.onWorkingHoursChanged();
    }
  },

  onWorkingHoursChanged() {
    console.log(`Working hours changed`);

    let enabled = document.querySelector("#working-hours-checkbox").checked;
    if (enabled) {
      document.querySelector("#working-hours").removeAttribute("disabled");
    } else {
      document.querySelector("#working-hours").setAttribute("disabled", "disabled");
    }

    // Times are strings of the form "HH:MM" in 24-hour format (or empty string)
    let startTime = document.querySelector("#start-time").value;
    let endTime = document.querySelector("#end-time").value;

    // `days` is an array containing en-US day strings: ['sunday', 'monday', ...]
    let days = [].slice.call(document.querySelectorAll("#days input:checked"))
                 .map(el => { return el.getAttribute("id")});

    browser.storage.local.set({"workingHours": {enabled, days, startTime, endTime}}).then(() => {
      console.log(`Saved update to working hours: enabled: ${enabled}, days: ${days.join(',')}, start time: ${startTime}, end time: ${endTime}`);
    }).catch((err) => {
      console.error(`Error updating working hours: ${err}`)
    });
  }
}

addEventListener("DOMContentLoaded", () => {
  Options.init();
}, { once: true });
