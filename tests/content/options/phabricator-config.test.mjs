import "../../../addon/content/options/phabricator-config.mjs";

describe("PhabricatorConfig Component", function () {
  let element;

  beforeEach(function () {
    element = document.createElement("phabricator-config");
    document.body.appendChild(element);
  });

  afterEach(function () {
    element.remove();
  });

  it("should render with default values", async function () {
    await element.updateComplete;

    let checkboxes = element.shadowRoot.querySelectorAll('input[type="checkbox"]');
    assert.equal(checkboxes.length, 2);
    assert.ok(!checkboxes[0].checked);
    assert.ok(!checkboxes[1].checked);
  });

  it("should display container property", async function () {
    element.container = true;
    await element.updateComplete;

    let checkboxes = element.shadowRoot.querySelectorAll('input[type="checkbox"]');
    assert.ok(checkboxes[0].checked);
  });

  it("should display inclReviewerGroups property", async function () {
    element.inclReviewerGroups = true;
    await element.updateComplete;

    let checkboxes = element.shadowRoot.querySelectorAll('input[type="checkbox"]');
    assert.ok(checkboxes[1].checked);
  });

  it("should display session status when logged in", async function () {
    element.hasSession = true;
    await element.updateComplete;

    let statusP = element.shadowRoot.getElementById("phabricator-session-status");
    assert.ok(statusP.textContent.includes("Found a Phabricator session cookie"));
  });

  it("should display session status when not logged in", async function () {
    element.hasSession = false;
    await element.updateComplete;

    let statusP = element.shadowRoot.getElementById("phabricator-session-status");
    assert.ok(statusP.textContent.includes("Did not find a Phabricator session cookie"));
  });

  it("should emit setting-change when container changes", async function () {
    await element.updateComplete;

    let eventPromise = new Promise((resolve) => {
      element.addEventListener("setting-change", resolve, { once: true });
    });

    let checkboxes = element.shadowRoot.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].checked = true;
    checkboxes[0].dispatchEvent(new Event("change", { bubbles: true }));

    let event = await eventPromise;
    assert.equal(event.detail.type, "phabricator");
    assert.equal(event.detail.setting, "container");
    assert.equal(event.detail.value, true);
    assert.ok(event.bubbles);
    assert.ok(event.composed);
  });

  it("should emit setting-change when inclReviewerGroups changes", async function () {
    await element.updateComplete;

    let eventPromise = new Promise((resolve) => {
      element.addEventListener("setting-change", resolve, { once: true });
    });

    let checkboxes = element.shadowRoot.querySelectorAll('input[type="checkbox"]');
    checkboxes[1].checked = true;
    checkboxes[1].dispatchEvent(new Event("change", { bubbles: true }));

    let event = await eventPromise;
    assert.equal(event.detail.setting, "inclReviewerGroups");
    assert.equal(event.detail.value, true);
  });

  it("should update all properties", async function () {
    element.container = true;
    element.inclReviewerGroups = true;
    element.hasSession = true;
    await element.updateComplete;

    let checkboxes = element.shadowRoot.querySelectorAll('input[type="checkbox"]');
    assert.ok(checkboxes[0].checked);
    assert.ok(checkboxes[1].checked);

    let statusP = element.shadowRoot.getElementById("phabricator-session-status");
    assert.ok(statusP.textContent.includes("Found a Phabricator session cookie"));
  });

  it("should handle session status changes", async function () {
    element.hasSession = false;
    await element.updateComplete;

    let statusP = element.shadowRoot.getElementById("phabricator-session-status");
    assert.ok(statusP.textContent.includes("Did not find a Phabricator session cookie"));

    element.hasSession = true;
    await element.updateComplete;

    statusP = element.shadowRoot.getElementById("phabricator-session-status");
    assert.ok(statusP.textContent.includes("Found a Phabricator session cookie"));
  });
});
