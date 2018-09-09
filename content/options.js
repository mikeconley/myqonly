const Options = {
  KEYS: [
    "phabricator",
    "bugzilla",
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
    }
  }
}

addEventListener("DOMContentLoaded", () => {
  Options.init();
}, { once: true });
