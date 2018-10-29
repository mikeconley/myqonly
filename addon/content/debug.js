const Debug = {
  KEYS: [
    "bugzilla",
    "ghuser"
  ],

  async init() {
    let update = document.getElementById("update");
    update.addEventListener("click", this);
  },

  handleEvent(event) {
    switch (event.type) {
      case "click": {
        return this.onClick(event);
        break;
      }
    }
  },

  onClick(event) {
    switch (event.target.id) {
      case "update": {
        browser.runtime.sendMessage({ name: "refresh" });
        break;
      }
    }
  },
}

addEventListener("DOMContentLoaded", () => {
  Debug.init();
}, { once: true });
