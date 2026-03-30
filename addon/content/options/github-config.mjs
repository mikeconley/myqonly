import { LitElement, html, adoptStyles } from "../../vendor/lit/lit-all.min.js";
import styles from "./github-config.css" with { type: "css" };
import { GitHubService } from "../../services/github-service.mjs";

class GitHubConfig extends LitElement {
  static properties = {
    username: { type: String },
    token: { type: String },
    ignoreOwnPrs: { type: Boolean },
    ignoreDraftPrs: { type: Boolean },
    ignoredUsers: { type: String },
    ignoredTeams: { type: String },
    ignoredRepos: { type: String },
    validationError: { type: Boolean }
  };

  constructor() {
    super();
    this.username = "";
    this.token = "";
    this.ignoreOwnPrs = false;
    this.ignoreDraftPrs = false;
    this.ignoredUsers = "";
    this.ignoredTeams = "";
    this.ignoredRepos = "";
    this.validationError = false;
  }

  connectedCallback() {
    super.connectedCallback();
    adoptStyles(this.renderRoot, [styles]);
  }

  render() {
    return html`
      <section>
        <h2>GitHub</h2>
        <label for="github-username">Username</label>
        <input
          type="text"
          id="github-username"
          .value=${this.username}
          @change=${this.#onChange}
          data-setting="username"
        />
        <label for="github-token">Github Access Token (optional)</label>
        <input
          type="password"
          id="github-token"
          .value=${this.token}
          @change=${this.#onChange}
          data-setting="token"
        />
        <div class="form-rows">
          <input
            type="checkbox"
            id="github-ignore-self"
            .checked=${this.ignoreOwnPrs}
            @change=${this.#onChange}
            data-setting="ignoreOwnPrs"
          />
          <label for="github-ignore-self">Ignore your own pull requests.</label>
        </div>
        <div class="form-rows">
          <input
            type="checkbox"
            id="github-ignore-draft"
            .checked=${this.ignoreDraftPrs}
            @change=${this.#onChange}
            data-setting="ignoreDraftPrs"
          />
          <label for="github-ignore-draft">Ignore draft pull requests.</label>
        </div>
        <label for="github-ignored-users"
          >Comma-separated list of github users to ignore requests from.</label
        >
        <input
          type="text"
          id="github-ignored-users"
          .value=${this.ignoredUsers}
          @change=${this.#onChange}
          data-setting="ignoredUsers"
        />
        <label for="github-ignored-teams"
          >Comma-separated list of github teams to ignore requests for.</label
        >
        <input
          type="text"
          id="github-ignored-teams"
          .value=${this.ignoredTeams}
          @change=${this.#onChange}
          data-setting="ignoredTeams"
        />
        <label for="github-ignored-repos"
          >Comma-separated list of github repositories to ignore in the form
          &lt;owner&gt;/&lt;repo&gt; (only applies when requested as part of a
          team).</label
        >
        <input
          type="text"
          id="github-ignored-repos"
          .value=${this.ignoredRepos}
          @change=${this.#onReposChange}
          data-setting="ignoredRepos"
        />
        <div
          id="github-repos-validation-error"
          class="error ${this.validationError ? "" : "hidden"}"
        >
          Invalid format: repositories must be in owner/repo format (e.g.,
          mozilla/gecko-dev)
        </div>
      </section>
    `;
  }

  #onChange(event) {
    let value;
    if (event.target.type === "checkbox") {
      value = event.target.checked;
    } else {
      value = event.target.value;
    }

    this.dispatchEvent(
      new CustomEvent("setting-change", {
        bubbles: true,
        composed: true,
        detail: {
          type: "github",
          setting: event.target.dataset.setting,
          value
        }
      })
    );
  }

  #onReposChange(event) {
    let value = event.target.value;
    let hasOldFormat = GitHubService.hasOldFormatRepos(value);
    this.validationError = hasOldFormat;

    this.dispatchEvent(
      new CustomEvent("setting-change", {
        bubbles: true,
        composed: true,
        detail: {
          type: "github",
          setting: "ignoredRepos",
          value
        }
      })
    );
  }
}

customElements.define("github-config", GitHubConfig);
