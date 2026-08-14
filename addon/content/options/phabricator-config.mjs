import { LitElement, html, adoptStyles } from "../../vendor/lit/lit-all.min.js";
import {
  PHABRICATOR_TOKEN_SETTINGS_URL,
  PHABRICATOR_TOKEN_STATES
} from "../../constants.mjs";
import styles from "./phabricator-config.css" with { type: "css" };

class PhabricatorConfig extends LitElement {
  static properties = {
    container: { type: Boolean },
    inclReviewerGroups: { type: Boolean },
    hasSession: { type: Boolean },
    apiToken: { type: String },
    tokenState: { type: String },
    tokenUserName: { type: String }
  };

  constructor() {
    super();
    this.container = false;
    this.inclReviewerGroups = false;
    this.hasSession = false;
    this.apiToken = "";
    this.tokenState = PHABRICATOR_TOKEN_STATES.UNSET;
    this.tokenUserName = "";
  }

  connectedCallback() {
    super.connectedCallback();
    adoptStyles(this.renderRoot, [styles]);
  }

  render() {
    return html`
      <section>
        <h2>Phabricator</h2>

        <label for="phabricator-apiToken">API token</label>
        <input
          type="password"
          id="phabricator-apiToken"
          .value=${this.apiToken}
          @change=${this.#onChange}
          data-setting="apiToken"
        />
        <p class="token-help">
          Recommended. MyQOnly will use the Phabricator API instead of reading
          the dashboard page, which is more reliable and does not depend on
          being logged in with the default container.
          <a href=${PHABRICATOR_TOKEN_SETTINGS_URL}>Generate a token</a>
        </p>
        <p id="phabricator-token-status">${this.#renderTokenStatus()}</p>

        ${this.apiToken ? "" : this.#renderSessionOption()}

        <div class="form-rows">
          <input
            type="checkbox"
            id="include-reviewer-groups"
            .checked=${this.inclReviewerGroups}
            @change=${this.#onChange}
            data-setting="inclReviewerGroups"
          />
          <label for="include-reviewer-groups"
            >Include reviewer groups in badge count</label
          >
        </div>
      </section>
    `;
  }

  /**
   * The session checkbox drives the scraping path only, so it and its status
   * line are hidden entirely once an API token takes over. The stored
   * container setting is left alone, so clearing the token restores it.
   */
  #renderSessionOption() {
    return html`
      <div class="form-rows">
        <input
          type="checkbox"
          id="phabricator-enabled"
          .checked=${this.container}
          @change=${this.#onChange}
          data-setting="container"
        />
        <label for="phabricator-enabled"
          >Use pre-existing Phabricator session in default container</label
        >
      </div>
      <p id="phabricator-session-status">
        ${this.hasSession
          ? html`<span class="yes-session"
              >Found a Phabricator session cookie in the default container</span
            >`
          : html`<span class="no-session"
              >Did not find a Phabricator session cookie. Are you logged in to
              Phabricator in the default container?</span
            >`}
      </p>
    `;
  }

  #renderTokenStatus() {
    switch (this.tokenState) {
      case PHABRICATOR_TOKEN_STATES.CHECKING:
        return html`<span class="token-checking">Checking token...</span>`;
      case PHABRICATOR_TOKEN_STATES.VALID:
        return html`<span class="token-valid"
          >Token accepted for ${this.tokenUserName}</span
        >`;
      case PHABRICATOR_TOKEN_STATES.INVALID:
        return html`<span class="token-invalid"
          >Phabricator rejected this token</span
        >`;
      default:
        return html`<span class="token-unset">No API token set</span>`;
    }
  }

  #onChange(event) {
    let value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;

    this.dispatchEvent(
      new CustomEvent("setting-change", {
        bubbles: true,
        composed: true,
        detail: {
          type: "phabricator",
          setting: event.target.dataset.setting,
          value
        }
      })
    );
  }
}

customElements.define("phabricator-config", PhabricatorConfig);
