import { LitElement, html } from "../../vendor/lit/lit-all.min.js";

class DebugPage extends LitElement {
  static properties = {
    phabricatorTestcase: { type: String },
    services: { type: String },
    oldUserKeys: { type: String }
  };


  constructor() {
    super();
    this.phabricatorTestcase = "";
    this.services = "";
    this.oldUserKeys = "";
  }

  render() {
    return html`
      <link rel="stylesheet" href="debug.css" />

      <h1>MyQOnly Debug Tools</h1>

      <ul>
        <li>
          <button @click=${this.#handleUpdate}>Check for updates now</button>
        </li>
        <li>
          <button @click=${this.#generatePhabricatorTestcase}>
            Generate Phabricator test case for current user state
          </button>
          <br />
          <textarea .value=${this.phabricatorTestcase} readonly></textarea>
        </li>
        <li>
          <button @click=${this.#showServices}>
            Retrieve and show services (sanitized)
          </button>
          <br />
          <textarea .value=${this.services} readonly></textarea>
        </li>
        <li>
          <button @click=${this.#showOldUserKeys}>
            Retrieve and show old userKeys (sanitized)
          </button>
          <br />
          <textarea .value=${this.oldUserKeys} readonly></textarea>
        </li>
      </ul>
    `;
  }

  #handleUpdate() {
    browser.runtime.sendMessage({ name: "refresh" });
  }

  async #generatePhabricatorTestcase() {
    let { pageBody } = await browser.runtime.sendMessage({
      name: "get-phabricator-html"
    });
    let parser = new DOMParser();
    let doc = parser.parseFromString(pageBody, "text/html");

    // Clear out any of the titles and links for the revisions, to avoid
    // security-sensitive things getting captured.
    let links = doc.body.querySelectorAll(".phui-oi-link");
    for (let link of links) {
      link.title = link.textContent = "Bug 123456 - This is some bug";
      link.href = "#";
    }

    let hiddenInputs = doc.body.querySelectorAll("input[type='hidden']");
    for (let input of hiddenInputs) {
      input.remove();
    }

    this.phabricatorTestcase = doc.body.innerHTML;
  }

  async #showServices() {
    let { services } = await browser.storage.local.get("services");
    if (!services) {
      this.services = "Couldn't find any services";
    } else {
      for (let service of services) {
        if (service.type == "bugzilla") {
          service.settings.apiKey = "<Bugzilla API key>";
        }
      }
      this.services = JSON.stringify(services, null, 2);
    }
  }

  async #showOldUserKeys() {
    let { oldUserKeys } = await browser.storage.local.get("oldUserKeys");
    if (!oldUserKeys) {
      this.oldUserKeys = "Couldn't find any old userKeys";
    } else {
      if (oldUserKeys.bugzilla) {
        oldUserKeys.bugzilla = "<Bugzilla API key>";
      }
      this.oldUserKeys = JSON.stringify(oldUserKeys, null, 2);
    }
  }
}

customElements.define("debug-page", DebugPage);
