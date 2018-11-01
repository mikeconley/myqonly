const Debug = {
  KEYS: [
    "bugzilla",
    "ghuser",
  ],

  async init() {
    window.addEventListener("click", this);
  },

  handleEvent(event) {
    switch (event.type) {
    case "click": {
      return this.onClick(event);
    }
    }
  },

  onClick(event) {
    switch (event.target.id) {
    case "update": {
      browser.runtime.sendMessage({ name: "refresh", });
      break;
    }
    case "generate-phabricator-testcase": {
      console.log("Generating Phabricator testcase...");
      this.generatePhabricatorTestcase();
      break;
    }
    }
  },

  async generatePhabricatorTestcase() {
    let pageBody = await browser.runtime.sendMessage({ name: "get-phabricator-html", });
    let parser = new DOMParser();
    let doc = parser.parseFromString(pageBody, "text/html");

    let activeRevisions = doc.querySelector(".phabricator-nav-content");

    // Clear out any of the titles and links for the revisions, to avoid security-sensitive
    // things getting captured.
    let links = activeRevisions.querySelectorAll(".phui-oi-link");
    for (let link of links) {
      link.title = link.textContent = "Bug 123456 - This is some bug";
      link.href = "#";
    }

    let hiddenInputs = activeRevisions.querySelectorAll("input[type='hidden']");
    for (let input of hiddenInputs) {
      input.remove();
    }

    let outputEl = document.getElementById("phabricator-testcase");
    outputEl.textContent = activeRevisions.innerHTML;
  },
};

addEventListener("DOMContentLoaded", () => {
  Debug.init();
}, { once: true, });
