const Panel = {
  async init() {
    let { newFeatures, featureRev, } =
      await browser.runtime.sendMessage({ name: "get-feature-rev", });
    if (newFeatures) {
      document.body.setAttribute("has-new-features", featureRev);
      let link = document.getElementById("has-new-features");
      link.href = link.href + "#featureRev-" + featureRev;
      link.addEventListener("click", this);
    }

    let reviews = await browser.runtime.sendMessage({ name: "get-reviews", });
    let total = reviews.phabricator + reviews.bugzilla + reviews.github;
    document.body.setAttribute("total-reviews", total);
    document.body.setAttribute("total-phabricator-reviews", reviews.phabricator);
    document.body.setAttribute("total-bugzilla-reviews", reviews.bugzilla);
    document.body.setAttribute("total-github-reviews", reviews.github);

    document.getElementById("total-reviews").textContent = total;
    document.getElementById("phabricator-review-num").textContent = reviews.phabricator;
    document.getElementById("bugzilla-review-num").textContent = reviews.bugzilla;
    document.getElementById("github-review-num").textContent = reviews.github;
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
    }
  },
};

addEventListener("DOMContentLoaded", () => {
  Panel.init();
}, { once: true, });
