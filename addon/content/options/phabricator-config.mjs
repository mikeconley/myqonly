import { LitElement, html, adoptStyles } from "../../vendor/lit/lit-all.min.js";
import styles from "./phabricator-config.css" with { type: "css" };

class PhabricatorConfig extends LitElement {
  static properties = {
    container: { type: Boolean },
    inclReviewerGroups: { type: Boolean },
    hasSession: { type: Boolean }
  };

  constructor() {
    super();
    this.container = false;
    this.inclReviewerGroups = false;
    this.hasSession = false;
  }

  connectedCallback() {
    super.connectedCallback();
    adoptStyles(this.renderRoot, [styles]);
  }

  render() {
    return html`
      <section>
        <h2>Phabricator</h2>
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
        <p id="phabricator-session-status">
          ${this.hasSession
            ? html`<span class="yes-session"
                >Found a Phabricator session cookie in the default
                container</span
              >`
            : html`<span class="no-session"
                >Did not find a Phabricator session cookie. Are you logged in to
                Phabricator in the default container?</span
              >`}
        </p>
      </section>
    `;
  }

  #onChange(event) {
    this.dispatchEvent(
      new CustomEvent("setting-change", {
        bubbles: true,
        composed: true,
        detail: {
          type: "phabricator",
          setting: event.target.dataset.setting,
          value: event.target.checked
        }
      })
    );
  }
}

customElements.define("phabricator-config", PhabricatorConfig);
