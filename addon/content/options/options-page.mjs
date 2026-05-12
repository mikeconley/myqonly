import { LitElement, html, adoptStyles } from "../../vendor/lit/lit-all.min.js";
import styles from "./options-page.css" with { type: "css" };
import { GitHubService } from "../../services/github-service.mjs";
import "./migration-warning.mjs";
import "./phabricator-config.mjs";
import "./bugzilla-config.mjs";
import "./github-config.mjs";
import "./working-hours-config.mjs";

class OptionsPage extends LitElement {
  static properties = {
    updateInterval: { type: Number },
    services: { type: Array },
    workingHours: { type: Object },
    migrationVisible: { type: Boolean },
    oldRepos: { type: String },
    phabricatorHasSession: { type: Boolean }
  };

  constructor() {
    super();
    this.updateInterval = 5;
    this.services = [];
    this.workingHours = {
      enabled: false,
      startTime: "09:00",
      endTime: "17:00",
      days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
    };
    this.migrationVisible = false;
    this.oldRepos = "";
    this.phabricatorHasSession = false;
    this._nextID = 0;
  }

  connectedCallback() {
    super.connectedCallback();
    adoptStyles(this.renderRoot, [styles]);
    this.addEventListener("setting-change", this.#onSettingChange);
    this.addEventListener("working-hours-change", this.#onWorkingHoursChange);
    this.addEventListener("help-migrate", this.#showMigrationHelper);
  }

  async firstUpdated() {
    await this.#loadSettings();
    await this.updateComplete;
    document.dispatchEvent(new CustomEvent("initted", { bubbles: true }));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("setting-change", this.#onSettingChange);
    this.removeEventListener("working-hours-change", this.#onWorkingHoursChange);
    this.removeEventListener("help-migrate", this.#showMigrationHelper);
  }

  async #loadSettings() {
    let { updateInterval } = await browser.storage.local.get("updateInterval");
    this.updateInterval = updateInterval || 5;

    let { services } = await browser.storage.local.get("services");
    this.services = services || [];

    for (let service of this.services) {
      this._nextID = Math.max(this._nextID, service.id);
    }
    this._nextID++;

    let { workingHours } = await browser.storage.local.get({
      workingHours: {
        enabled: false,
        startTime: "09:00",
        endTime: "17:00",
        days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
      }
    });
    this.workingHours = workingHours;

    await this.#checkMigrationNeeded();
    await this.#checkPhabricatorSession();
  }

  async #checkMigrationNeeded() {
    let { needsGitHubMigration, oldIgnoredRepos } =
      await browser.storage.local.get([
        "needsGitHubMigration",
        "oldIgnoredRepos"
      ]);

    if (needsGitHubMigration) {
      this.migrationVisible = true;
      this.oldRepos = oldIgnoredRepos;
    }
  }

  async #checkPhabricatorSession() {
    let hasSession = await browser.runtime.sendMessage({
      name: "check-for-phabricator-session"
    });
    this.phabricatorHasSession = hasSession;
  }

  render() {
    let phabSettings = this.#getServiceSettings("phabricator");
    let bugzillaSettings = this.#getServiceSettings("bugzilla");
    let githubSettings = this.#getServiceSettings("github");

    return html`
      <h1>MyQOnly Options</h1>

      <migration-warning
        .visible=${this.migrationVisible}
        .oldRepos=${this.oldRepos}
      ></migration-warning>

      <section>
        <h2>General</h2>
        <label>
          Check for updates every
          <input
            type="number"
            min="1"
            max="1000"
            .value=${this.updateInterval.toString()}
            @change=${this.#onUpdateIntervalChange}
          />
          minutes
        </label>
      </section>

      <section>
        <h2>Services</h2>

        <phabricator-config
          .container=${!!phabSettings.container}
          .inclReviewerGroups=${!!phabSettings.inclReviewerGroups}
          .hasSession=${this.phabricatorHasSession}
        ></phabricator-config>

        <bugzilla-config
          .apiKey=${bugzillaSettings.apiKey || ""}
          .needinfos=${!!bugzillaSettings.needinfos}
        ></bugzilla-config>

        <github-config
          .username=${githubSettings.username || ""}
          .token=${githubSettings.token || ""}
          .ignoreOwnPrs=${!!githubSettings.ignoreOwnPrs}
          .ignoreDraftPrs=${!!githubSettings.ignoreDraftPrs}
          .ignoredUsers=${githubSettings.ignoredUsers || ""}
          .ignoredTeams=${githubSettings.ignoredTeams || ""}
          .ignoredRepos=${githubSettings.ignoredRepos || ""}
        ></github-config>
      </section>

      <working-hours-config
        .enabled=${this.workingHours.enabled}
        .startTime=${this.workingHours.startTime}
        .endTime=${this.workingHours.endTime}
        .days=${this.workingHours.days}
      ></working-hours-config>

      <section>
        <p>
          Thanks for using MyQOnly!
          <a href="https://github.com/mikeconley/myqonly/"
            >Bug reports, enhancement requests and pull requests welcome!</a
          >
        </p>
        <p>
          <a href="/content/release-notes/release-notes.html">Release notes</a>
        </p>
      </section>

      <a id="debug" href="/content/debug/debug.html">Debug</a>
    `;
  }

  #getServiceSettings(serviceType) {
    for (let instance of this.services) {
      if (instance.type == serviceType) {
        return instance.settings;
      }
    }

    let settings = {};
    this.services.push({
      id: this._nextID++,
      type: serviceType,
      settings
    });

    return settings;
  }

  async #onUpdateIntervalChange(event) {
    let updateInterval = parseInt(event.target.value, 10);
    this.updateInterval = updateInterval;
    await browser.storage.local.set({ updateInterval });
  }

  async #onSettingChange(event) {
    let { type, setting, value } = event.detail;
    let settings = this.#getServiceSettings(type);

    if (value !== undefined && value !== null && value !== "") {
      settings[setting] = value;
    } else {
      delete settings[setting];
    }

    await browser.storage.local.set({ services: this.services });

    if (type === "github" && setting === "ignoredRepos") {
      await this.#checkGitHubMigrationStatus();
    }
  }

  async #onWorkingHoursChange(event) {
    this.workingHours = event.detail;
    await browser.storage.local.set({ workingHours: this.workingHours });
  }

  async #checkGitHubMigrationStatus() {
    let { needsGitHubMigration } = await browser.storage.local.get(
      "needsGitHubMigration"
    );

    if (!needsGitHubMigration) {
      document.dispatchEvent(new CustomEvent("migration-check-complete", { bubbles: true }));
      return;
    }

    let githubService = this.services.find((s) => s.type === "github");
    if (!githubService) {
      document.dispatchEvent(new CustomEvent("migration-check-complete", { bubbles: true }));
      return;
    }

    if (!GitHubService.hasOldFormatRepos(githubService.settings.ignoredRepos)) {
      await this.#clearMigrationWarning();
    }

    document.dispatchEvent(new CustomEvent("migration-check-complete", { bubbles: true }));
  }

  async #clearMigrationWarning() {
    await browser.storage.local.remove([
      "needsGitHubMigration",
      "oldIgnoredRepos"
    ]);
    this.migrationVisible = false;
  }

  async #showMigrationHelper() {
    let githubService = this.services.find((s) => s.type === "github");

    if (!githubService || !githubService.settings.username) {
      alert("Please configure your GitHub username first.");
      return;
    }

    let username = githubService.settings.username;
    let token = githubService.settings.token;

    let query = `is:pr is:open review-requested:${username}`;
    let url = new URL("https://api.github.com/search/issues");
    url.searchParams.set("q", query);
    url.searchParams.set("per_page", "100");

    let headers = {
      Accept: "application/vnd.github.v3+json"
    };
    if (token) {
      headers["Authorization"] = `token ${token}`;
    }

    try {
      let response = await fetch(url, {
        method: "GET",
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`GitHub request failed: ${response.status}`);
      }

      let data = await response.json();

      let repos = new Set();
      for (let item of data.items) {
        let match = item.repository_url.match(/\/repos\/([^/]+\/[^/]+)/);
        if (match) {
          repos.add(match[1]);
        }
      }

      this.#showRepoSelectionDialog(Array.from(repos));
    } catch (error) {
      console.error("Failed to fetch GitHub repositories:", error);
      alert(`Failed to fetch your GitHub review requests: ${error.message}`);
    }
  }

  #showRepoSelectionDialog(repos) {
    let dialog = this.shadowRoot.querySelector("dialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.innerHTML = `
        <h2>Select Repositories to Ignore</h2>
        <p>Based on your current review queue, which repositories should be ignored?</p>
        <div id="repo-list"></div>
        <div class="dialog-buttons">
          <button id="save-migration">Save Selection</button>
          <button id="cancel-migration">Cancel</button>
        </div>
      `;
      this.shadowRoot.appendChild(dialog);

      dialog.querySelector("#save-migration").addEventListener("click", () => {
        this.#onSaveMigration();
      });
      dialog.querySelector("#cancel-migration").addEventListener("click", () => {
        dialog.close();
      });
    }

    let repoList = dialog.querySelector("#repo-list");
    repoList.innerHTML = "";
    for (let repo of repos) {
      let label = document.createElement("label");
      label.className = "repo-item";
      let checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = repo;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" " + repo));
      repoList.appendChild(label);
    }

    dialog.showModal();
  }

  async #onSaveMigration() {
    let dialog = this.shadowRoot.querySelector("dialog");
    let selected = Array.from(dialog.querySelectorAll("input:checked")).map(
      (cb) => cb.value
    );

    let githubSettings = this.#getServiceSettings("github");
    githubSettings.ignoredRepos = selected.join(", ");

    await browser.storage.local.set({ services: this.services });
    await browser.storage.local.remove([
      "needsGitHubMigration",
      "oldIgnoredRepos"
    ]);

    this.migrationVisible = false;
    this.requestUpdate();

    dialog.close();
  }
}

customElements.define("options-page", OptionsPage);
