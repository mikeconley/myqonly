import { LitElement, html, adoptStyles } from "../../vendor/lit/lit-all.min.js";
import styles from "./bugzilla-config.css" with { type: "css" };

class BugzillaConfig extends LitElement {
  static properties = {
    apiKey: { type: String },
    needinfos: { type: Boolean }
  };

  constructor() {
    super();
    this.apiKey = "";
    this.needinfos = false;
  }

  connectedCallback() {
    super.connectedCallback();
    adoptStyles(this.renderRoot, [styles]);
  }

  render() {
    return html`
      <section>
        <h2>Bugzilla</h2>
        <label for="bugzilla-apiKey">API Key</label>
        <input
          type="password"
          id="bugzilla-apiKey"
          .value=${this.apiKey}
          @change=${this.#onChange}
          data-setting="apiKey"
        />
        <div class="form-rows">
          <input
            type="checkbox"
            id="bugzilla-needinfos"
            .checked=${this.needinfos}
            @change=${this.#onChange}
            data-setting="needinfos"
          />
          <label for="bugzilla-needinfos">Count open needinfos too</label>
        </div>
      </section>
    `;
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
          type: "bugzilla",
          setting: event.target.dataset.setting,
          value
        }
      })
    );
  }
}

customElements.define("bugzilla-config", BugzillaConfig);
