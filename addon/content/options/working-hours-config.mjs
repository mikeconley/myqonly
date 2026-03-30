import { LitElement, html, adoptStyles } from "../../vendor/lit/lit-all.min.js";
import styles from "./working-hours-config.css" with { type: "css" };

class WorkingHoursConfig extends LitElement {
  static properties = {
    enabled: { type: Boolean },
    startTime: { type: String },
    endTime: { type: String },
    days: { type: Array }
  };

  constructor() {
    super();
    this.enabled = false;
    this.startTime = "09:00";
    this.endTime = "17:00";
    this.days = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  }

  connectedCallback() {
    super.connectedCallback();
    adoptStyles(this.renderRoot, [styles]);
  }

  render() {
    return html`
      <section id="working-hours">
        <h2>Working hours</h2>
        <input
          type="checkbox"
          id="working-hours-checkbox"
          .checked=${this.enabled}
          @change=${this.#onEnabledChange}
        /><label for="working-hours-checkbox"
          >Only show review count during working hours</label
        >

        <fieldset id="working-hours-fields" ?disabled=${!this.enabled}>
          <h3>Days</h3>
          <div class="field-rows days">
            <input
              type="checkbox"
              id="sunday"
              .checked=${this.days.includes("sunday")}
              @change=${this.#onFieldChange}
              data-day="sunday"
            />
            <label for="sunday">Sunday</label>

            <input
              type="checkbox"
              id="monday"
              .checked=${this.days.includes("monday")}
              @change=${this.#onFieldChange}
              data-day="monday"
            />
            <label for="monday">Monday</label>

            <input
              type="checkbox"
              id="tuesday"
              .checked=${this.days.includes("tuesday")}
              @change=${this.#onFieldChange}
              data-day="tuesday"
            />
            <label for="tuesday">Tuesday</label>

            <input
              type="checkbox"
              id="wednesday"
              .checked=${this.days.includes("wednesday")}
              @change=${this.#onFieldChange}
              data-day="wednesday"
            />
            <label for="wednesday">Wednesday</label>

            <input
              type="checkbox"
              id="thursday"
              .checked=${this.days.includes("thursday")}
              @change=${this.#onFieldChange}
              data-day="thursday"
            />
            <label for="thursday">Thursday</label>

            <input
              type="checkbox"
              id="friday"
              .checked=${this.days.includes("friday")}
              @change=${this.#onFieldChange}
              data-day="friday"
            />
            <label for="friday">Friday</label>

            <input
              type="checkbox"
              id="saturday"
              .checked=${this.days.includes("saturday")}
              @change=${this.#onFieldChange}
              data-day="saturday"
            />
            <label for="saturday">Saturday</label>
          </div>

          <h3>Hours</h3>
          <div class="field-rows">
            <label for="start-time">Start time</label>
            <input
              type="time"
              id="start-time"
              .value=${this.startTime}
              @change=${this.#onFieldChange}
            />

            <label for="end-time">End time</label>
            <input
              type="time"
              id="end-time"
              .value=${this.endTime}
              @change=${this.#onFieldChange}
            />
          </div>
        </fieldset>
      </section>
    `;
  }

  #onEnabledChange(event) {
    this.#emitChange();
  }

  #onFieldChange(event) {
    this.#emitChange();
  }

  #emitChange() {
    let enabled = this.shadowRoot.getElementById("working-hours-checkbox")
      .checked;
    let startTime = this.shadowRoot.getElementById("start-time").value;
    let endTime = this.shadowRoot.getElementById("end-time").value;
    let days = Array.from(
      this.shadowRoot.querySelectorAll(".days input:checked")
    ).map((el) => el.dataset.day);

    this.dispatchEvent(
      new CustomEvent("working-hours-change", {
        bubbles: true,
        composed: true,
        detail: {
          enabled,
          startTime,
          endTime,
          days
        }
      })
    );
  }
}

customElements.define("working-hours-config", WorkingHoursConfig);
