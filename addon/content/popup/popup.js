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
    await this.refresh();
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

    await new Promise(resolve => window.requestAnimationFrame(resolve));

    let reviews = await browser.runtime.sendMessage({ name: "get-reviews", });
    let total = reviews.phabricator + reviews.bugzilla + reviews.github;
    document.body.setAttribute("total-phabricator-reviews", reviews.phabricator);
    document.body.setAttribute("total-bugzilla-reviews", reviews.bugzilla);
    document.body.setAttribute("total-github-reviews", reviews.github);

    document.getElementById("phabricator-review-num").textContent = reviews.phabricator;
    document.getElementById("bugzilla-review-num").textContent = reviews.bugzilla;
    document.getElementById("github-review-num").textContent = reviews.github;

    if (total) {
      let noun = total > 1 ? "reviews" : "review";
      status.textContent = `Found ${total} ${noun} to do`;
    } else {
      status.textContent = "No reviews to do! \\o/";
    }
  },
};

addEventListener("DOMContentLoaded", () => {
  Panel.init();
}, { once: true, });
