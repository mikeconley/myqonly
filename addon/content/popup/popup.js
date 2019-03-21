const Panel = {
  async init() {
    let { newFeatures, featureRev, } =
      await browser.runtime.sendMessage({ name: "get-feature-rev", });
    if (newFeatures) {
      document.body.setAttribute("has-new-features", featureRev);
      let link = document.getElementById("has-new-features");
      link.href = link.href + "#featureRev-" + featureRev;
    }

    window.addEventListener("click", this);
    await this.updatePanel();
  },

  handleEvent(event) {
    switch (event.type) {
    case "click": {
      this.onClick(event);
      break;
    }
    }
  },

  onClick(event) {
    switch (event.target.id) {
    case "has-new-features": {
      browser.tabs.create({
        url: event.target.href,
      });
      browser.runtime.sendMessage({ name: "opened-release-notes", });
      event.preventDefault();
      window.close();
      return false;
    }
    case "refresh": {
      this.refresh();
      return false;
    }
    case "options": {
      browser.runtime.openOptionsPage();
      event.preventDefault();
      window.close();
      return false;
    }
    }
  },

  async refresh() {
    let status = document.getElementById("status");
    status.textContent = "Refreshing...";

    let refreshPromise = browser.runtime.sendMessage({ name: "refresh", });
    let visualDelayPromise = new Promise(resolve => setTimeout(resolve, 250));
    await Promise.all([refreshPromise, visualDelayPromise,]);

    await this.updatePanel();
  },

  async updatePanel() {
    let status = document.getElementById("status");
    let states = await browser.runtime.sendMessage({ name: "get-states", });
    let total = 0;
    for (let [, state,] of states) {
      switch (state.type) {
      case "bugzilla": {
        let serviceTotal = 0;
        let flagsElt = document.getElementById("bugzilla-flags");
        flagsElt.innerHTML = "";

        for (let [flag, count] of Object.entries(state.data)) {
          serviceTotal += count;

          document.body.setAttribute(`total-bugzilla-${flag}s`, count || 0);

          if (!count || count === 0) {
            continue;
          }

          let sectionElt = document.createElement("section");
          sectionElt.id = "bugzilla-" + flag + "s";
          let anchorElt = document.createElement("a");
          anchorElt.href =
            "https://bugzilla.mozilla.org/page.cgi?id=mydashboard.html";
          anchorElt.textContent = `${count} ${flag}(s) on Bugzilla`;
          sectionElt.appendChild(anchorElt);
          flagsElt.appendChild(sectionElt);
        }

        total += serviceTotal;
        break;
      }
      case "phabricator": {
        // If Phabricator is disabled, well, just skip.
        if (state.data.disabled) {
          continue;
        }

        let phabDisconnected =
          document.getElementById("phabricator-disconnected");
        if (!state.data.connected) {
          phabDisconnected.classList.remove("hidden");
        } else {
          phabDisconnected.classList.add("hidden");
        }

        let serviceTotal = state.data.reviewTotal || 0;
        document.body.setAttribute("total-phabricator-reviews",
          serviceTotal || 0);
        document.getElementById("phabricator-review-num").textContent =
          serviceTotal || 0;

        total += serviceTotal;
        break;
      }
      case "github": {
        let serviceTotal = state.data.reviewTotal || 0;
        document.body.setAttribute("total-github-reviews",
          serviceTotal || 0);
        document.getElementById("github-review-num").textContent =
          serviceTotal || 0;

        total += serviceTotal;
        break;
      }
      }
    }

    if (total) {
      let noun = total > 1 ? "things" : "thing";
      status.textContent = `Found ${total} ${noun} to do`;
    } else {
      status.textContent = "Nothing to do! \\o/";
    }
  },
};

addEventListener("DOMContentLoaded", () => {
  Panel.init();
}, { once: true, });
