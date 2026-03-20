import "../../../addon/content/options/working-hours-config.mjs";

describe("WorkingHoursConfig Component", function () {
  let element;

  beforeEach(function () {
    element = document.createElement("working-hours-config");
    document.body.appendChild(element);
  });

  afterEach(function () {
    element.remove();
  });

  it("should render with default values", async function () {
    await element.updateComplete;

    let enabledCheckbox = element.shadowRoot.querySelector('input[type="checkbox"]');
    assert.ok(!enabledCheckbox.checked);

    let fieldset = element.shadowRoot.querySelector("fieldset");
    assert.ok(fieldset.disabled);
  });

  it("should display enabled state", async function () {
    element.enabled = true;
    await element.updateComplete;

    let enabledCheckbox = element.shadowRoot.querySelector('input[type="checkbox"]');
    assert.ok(enabledCheckbox.checked);

    let fieldset = element.shadowRoot.querySelector("fieldset");
    assert.ok(!fieldset.disabled);
  });

  it("should display time values", async function () {
    element.startTime = "08:00";
    element.endTime = "18:00";
    await element.updateComplete;

    let timeInputs = element.shadowRoot.querySelectorAll('input[type="time"]');
    assert.equal(timeInputs[0].value, "08:00");
    assert.equal(timeInputs[1].value, "18:00");
  });

  it("should display selected days", async function () {
    element.days = ["monday", "wednesday", "friday"];
    await element.updateComplete;

    let dayCheckboxes = element.shadowRoot.querySelectorAll(".days input");
    assert.ok(!dayCheckboxes[0].checked); // sunday
    assert.ok(dayCheckboxes[1].checked);  // monday
    assert.ok(!dayCheckboxes[2].checked); // tuesday
    assert.ok(dayCheckboxes[3].checked);  // wednesday
    assert.ok(!dayCheckboxes[4].checked); // thursday
    assert.ok(dayCheckboxes[5].checked);  // friday
    assert.ok(!dayCheckboxes[6].checked); // saturday
  });

  it("should emit working-hours-change when enabled changes", async function () {
    await element.updateComplete;

    let eventPromise = new Promise((resolve) => {
      element.addEventListener("working-hours-change", resolve, { once: true });
    });

    let enabledCheckbox = element.shadowRoot.querySelector('input[type="checkbox"]');
    enabledCheckbox.checked = true;
    enabledCheckbox.dispatchEvent(new Event("change", { bubbles: true }));

    let event = await eventPromise;
    assert.ok(event.detail.enabled);
    assert.equal(event.detail.startTime, "09:00");
    assert.equal(event.detail.endTime, "17:00");
    assert.deepEqual(event.detail.days, ["monday", "tuesday", "wednesday", "thursday", "friday"]);
    assert.ok(event.bubbles);
    assert.ok(event.composed);
  });

  it("should emit working-hours-change when time changes", async function () {
    element.enabled = true;
    await element.updateComplete;

    let eventPromise = new Promise((resolve) => {
      element.addEventListener("working-hours-change", resolve, { once: true });
    });

    let timeInputs = element.shadowRoot.querySelectorAll('input[type="time"]');
    timeInputs[0].value = "08:30";
    timeInputs[0].dispatchEvent(new Event("change", { bubbles: true }));

    let event = await eventPromise;
    assert.equal(event.detail.startTime, "08:30");
  });

  it("should emit working-hours-change when days change", async function () {
    element.enabled = true;
    element.days = ["monday"];
    await element.updateComplete;

    let eventPromise = new Promise((resolve) => {
      element.addEventListener("working-hours-change", resolve, { once: true });
    });

    let dayCheckboxes = element.shadowRoot.querySelectorAll(".days input");
    dayCheckboxes[0].checked = true; // sunday
    dayCheckboxes[0].dispatchEvent(new Event("change", { bubbles: true }));

    let event = await eventPromise;
    assert.ok(event.detail.days.includes("sunday"));
    assert.ok(event.detail.days.includes("monday"));
  });

  it("should enable fieldset when enabled is true", async function () {
    element.enabled = false;
    await element.updateComplete;

    let fieldset = element.shadowRoot.querySelector("fieldset");
    assert.ok(fieldset.disabled);

    element.enabled = true;
    await element.updateComplete;

    fieldset = element.shadowRoot.querySelector("fieldset");
    assert.ok(!fieldset.disabled);
  });

  it("should handle empty days array", async function () {
    element.days = [];
    await element.updateComplete;

    let dayCheckboxes = element.shadowRoot.querySelectorAll(".days input");
    for (let checkbox of dayCheckboxes) {
      assert.ok(!checkbox.checked);
    }
  });

  it("should handle all days selected", async function () {
    element.days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    await element.updateComplete;

    let dayCheckboxes = element.shadowRoot.querySelectorAll(".days input");
    for (let checkbox of dayCheckboxes) {
      assert.ok(checkbox.checked);
    }
  });
});
