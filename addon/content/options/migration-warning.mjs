import { LitElement, html } from "../../vendor/lit/lit-all.min.js";

/**
 * Warning banner component for GitHub repository migration.
 * Displays when repositories are in old format and provides migration helper.
 */
class MigrationWarning extends LitElement {
  static properties = {
    visible: { type: Boolean },
    oldRepos: { type: String }
  };


  constructor() {
    super();
    this.visible = false;
    this.oldRepos = "";
  }

  render() {
    if (!this.visible) {
      return html`
        <link rel="stylesheet" href="migration-warning.css" />
        <div class="warning hidden"></div>
      `;
    }

    return html`
      <link rel="stylesheet" href="migration-warning.css" />
      <div id="github-migration-warning" class="warning">
        <strong>⚠️ Configuration Update Required</strong>
        <p>
          Your GitHub ignored repositories are in an old format. Please update
          them to use the <code>owner/repo</code> format.
        </p>
        <p>Old value: <code id="old-repos">${this.oldRepos}</code></p>
        <button id="help-migrate" @click=${this.#onHelpClick}>
          Help me migrate
        </button>
      </div>
    `;
  }

  /**
   * Handles click on "Help me migrate" button.
   * Dispatches event for parent to show migration helper.
   */
  #onHelpClick() {
    this.dispatchEvent(new CustomEvent("help-migrate", { bubbles: true, composed: true }));
  }
}

customElements.define("migration-warning", MigrationWarning);
