const Panel = {
  async init() {
    let reviews = await browser.runtime.sendMessage({ name: "get-reviews" });
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
};

addEventListener("DOMContentLoaded", () => {
  Panel.init();
}, { once: true });
