import { LitElement, html, adoptStyles } from "../../vendor/lit/lit-all.min.js";
import sheet from "./popup-page.css" with { type: "css" };

class PopupPage extends LitElement {
  static styles = sheet;
  static properties = {
    status: { type: String },
    hasNewFeatures: { type: Boolean },
    featureRev: { type: String },
    needsGitHubMigration: { type: Boolean },
    phabricatorDisconnected: { type: Boolean },
    phabricatorUserReviews: { type: Number },
    phabricatorGroupReviews: { type: Number },
    bugzillaReviews: { type: Number },
    bugzillaNeedinfos: { type: Number },
    githubReviews: { type: Number },
    githubReviewUrl: { type: String }
  };

  constructor() {
    super();
    this.status = "";
    this.hasNewFeatures = false;
    this.featureRev = "";
    this.needsGitHubMigration = false;
    this.phabricatorDisconnected = false;
    this.phabricatorUserReviews = 0;
    this.phabricatorGroupReviews = 0;
    this.bugzillaReviews = 0;
    this.bugzillaNeedinfos = 0;
    this.githubReviews = 0;
    this.githubReviewUrl = "https://github.com/pulls/review-requested";
  }

  connectedCallback() {
    super.connectedCallback();
    adoptStyles(this.renderRoot, [sheet]);
  }

  async firstUpdated() {
    await this.#loadState();
    await this.updateComplete;
    this.dispatchEvent(
      new CustomEvent("initted", {
        bubbles: true,
        composed: true
      })
    );
  }

  async #loadState() {
    let { newFeatures, featureRev } = await browser.runtime.sendMessage({
      name: "get-feature-rev"
    });
    if (newFeatures) {
      this.hasNewFeatures = true;
      this.featureRev = featureRev;
    }

    let { needsGitHubMigration } = await browser.storage.local.get(
      "needsGitHubMigration"
    );
    this.needsGitHubMigration = !!needsGitHubMigration;

    await this.#updatePanel();
  }

  async #updatePanel() {
    let { reviewStates } = await browser.storage.local.get("reviewStates");
    let states = new Map(reviewStates || []);
    let total = 0;

    this.phabricatorDisconnected = false;
    this.phabricatorUserReviews = 0;
    this.phabricatorGroupReviews = 0;
    this.bugzillaReviews = 0;
    this.bugzillaNeedinfos = 0;
    this.githubReviews = 0;
    this.githubReviewUrl = "https://github.com/pulls/review-requested";

    for (let [, state] of states) {
      switch (state.type) {
        case "bugzilla": {
          this.bugzillaReviews = state.data.reviewTotal || 0;
          this.bugzillaNeedinfos = state.data.needinfoTotal || 0;
          total += (state.data.reviewTotal || 0) + (state.data.needinfoTotal || 0);
          break;
        }
        case "phabricator": {
          if (state.data.disabled) {
            continue;
          }

          this.phabricatorDisconnected = state.data.connected === false;
          this.phabricatorUserReviews = state.data.userReviewTotal || 0;
          this.phabricatorGroupReviews = state.data.groupReviewTotal || 0;
          total += state.data.reviewTotal || 0;
          break;
        }
        case "github": {
          this.githubReviews = state.data.reviewTotal || 0;
          this.githubReviewUrl =
            state.data.reviewUrl || "https://github.com/pulls/review-requested";
          total += state.data.reviewTotal || 0;
          break;
        }
      }
    }

    if (total) {
      let noun = total > 1 ? "things" : "thing";
      this.status = `Found ${total} ${noun} to do`;
    } else {
      this.status = "Nothing to do! \\o/";
    }
  }

  render() {
    return html`
      <header>
        <a class="icon" @click=${this.#onOptionsClick}></a>
        <span id="status">${this.status}</span>
        <button id="refresh" class="icon" @click=${this.#onRefreshClick}></button>
      </header>

      <div class="phabricator-disconnected ${this.phabricatorDisconnected ? "" : "hidden"}">
        Warning: Not logged in to Phabricator
      </div>

      <a
        class="warning-banner ${this.needsGitHubMigration ? "" : "hidden"}"
        @click=${this.#onGitHubMigrationClick}
      >
        Your GitHub config needs updating. Click here to fix it.
      </a>

      <section>
        <a href="https://phabricator.services.mozilla.com/differential/query/active/">
          <span id="phabricator-user-review-num">${this.phabricatorUserReviews}</span> review(s) on Phabricator
        </a>
      </section>

      <section class="${this.phabricatorGroupReviews === 0 ? "hidden" : ""}">
        <a href="https://phabricator.services.mozilla.com/differential/query/active/">
          <span>${this.phabricatorGroupReviews}</span> reviewer group review(s) on Phabricator
        </a>
      </section>

      <section class="${this.bugzillaReviews === 0 ? "hidden" : ""}">
        <a href="https://bugzilla.mozilla.org/page.cgi?id=mydashboard.html">
          <span>${this.bugzillaReviews}</span> review(s) on Bugzilla
        </a>
      </section>

      <section class="${this.bugzillaNeedinfos === 0 ? "hidden" : ""}">
        <a href="https://bugzilla.mozilla.org/page.cgi?id=mydashboard.html">
          <span>${this.bugzillaNeedinfos}</span> needinfo(s) on Bugzilla
        </a>
      </section>

      <section class="${this.githubReviews === 0 ? "hidden" : ""}">
        <a href="${this.githubReviewUrl}">
          <span id="github-review-num">${this.githubReviews}</span> review(s) on Github
        </a>
      </section>

      <a
        class="new-features ${this.hasNewFeatures ? "" : "hidden"}"
        target="_blank"
        href="${
          this.hasNewFeatures
            ? `/content/release-notes/release-notes.html#featureRev-${this.featureRev}`
            : "/content/release-notes/release-notes.html"
        }"
        @click=${this.#onNewFeaturesClick}
      >
        New features
      </a>
    `;
  }

  async #onRefreshClick() {
    this.status = "Refreshing...";

    let refreshPromise = browser.runtime.sendMessage({ name: "refresh" });
    let visualDelayPromise = new Promise((resolve) => setTimeout(resolve, 250));
    await Promise.all([refreshPromise, visualDelayPromise]);

    await this.#updatePanel();
  }

  #onOptionsClick(event) {
    browser.runtime.openOptionsPage();
    event.preventDefault();
    window.close();
  }

  #onGitHubMigrationClick(event) {
    browser.runtime.openOptionsPage();
    event.preventDefault();
    window.close();
  }

  #onNewFeaturesClick(event) {
    browser.tabs.create({
      url: event.target.href
    });
    browser.runtime.sendMessage({ name: "opened-release-notes" });
    event.preventDefault();
    window.close();
  }
}

customElements.define("popup-page", PopupPage);
