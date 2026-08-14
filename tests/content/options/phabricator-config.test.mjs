import "../../../addon/content/options/phabricator-config.mjs";
import { PHABRICATOR_TOKEN_STATES } from "../../../addon/constants.mjs";

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

    let checkboxes = element.shadowRoot.querySelectorAll(
      'input[type="checkbox"]'
    );
    assert.equal(checkboxes.length, 2);
    assert.ok(!checkboxes[0].checked);
    assert.ok(!checkboxes[1].checked);
  });

  it("should display container property", async function () {
    element.container = true;
    await element.updateComplete;

    let checkboxes = element.shadowRoot.querySelectorAll(
      'input[type="checkbox"]'
    );
    assert.ok(checkboxes[0].checked);
  });

  it("should display inclReviewerGroups property", async function () {
    element.inclReviewerGroups = true;
    await element.updateComplete;

    let checkboxes = element.shadowRoot.querySelectorAll(
      'input[type="checkbox"]'
    );
    assert.ok(checkboxes[1].checked);
  });

  it("should display session status when logged in", async function () {
    element.hasSession = true;
    await element.updateComplete;

    let statusP = element.shadowRoot.getElementById(
      "phabricator-session-status"
    );
    assert.ok(
      statusP.textContent.includes("Found a Phabricator session cookie")
    );
  });

  it("should display session status when not logged in", async function () {
    element.hasSession = false;
    await element.updateComplete;

    let statusP = element.shadowRoot.getElementById(
      "phabricator-session-status"
    );
    assert.ok(
      statusP.textContent.includes("Did not find a Phabricator session cookie")
    );
  });

  it("should emit setting-change when container changes", async function () {
    await element.updateComplete;

    let eventPromise = new Promise((resolve) => {
      element.addEventListener("setting-change", resolve, { once: true });
    });

    let checkboxes = element.shadowRoot.querySelectorAll(
      'input[type="checkbox"]'
    );
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

    let checkboxes = element.shadowRoot.querySelectorAll(
      'input[type="checkbox"]'
    );
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

    let checkboxes = element.shadowRoot.querySelectorAll(
      'input[type="checkbox"]'
    );
    assert.ok(checkboxes[0].checked);
    assert.ok(checkboxes[1].checked);

    let statusP = element.shadowRoot.getElementById(
      "phabricator-session-status"
    );
    assert.ok(
      statusP.textContent.includes("Found a Phabricator session cookie")
    );
  });

  it("should handle session status changes", async function () {
    element.hasSession = false;
    await element.updateComplete;

    let statusP = element.shadowRoot.getElementById(
      "phabricator-session-status"
    );
    assert.ok(
      statusP.textContent.includes("Did not find a Phabricator session cookie")
    );

    element.hasSession = true;
    await element.updateComplete;

    statusP = element.shadowRoot.getElementById("phabricator-session-status");
    assert.ok(
      statusP.textContent.includes("Found a Phabricator session cookie")
    );
  });

  describe("API token", function () {
    function tokenField() {
      return element.shadowRoot.getElementById("phabricator-apiToken");
    }

    function tokenStatus() {
      return element.shadowRoot.getElementById("phabricator-token-status");
    }

    it("should render an empty password field by default", async function () {
      await element.updateComplete;

      assert.equal(tokenField().type, "password");
      assert.equal(tokenField().value, "");
    });

    it("should display the apiToken property", async function () {
      element.apiToken = "api-secrettoken";
      await element.updateComplete;

      assert.equal(tokenField().value, "api-secrettoken");
    });

    // The component previously only ever read event.target.checked, which
    // would have stored undefined for a text field.
    it("should emit the string value when the token changes", async function () {
      await element.updateComplete;

      let eventPromise = new Promise((resolve) => {
        element.addEventListener("setting-change", resolve, { once: true });
      });

      tokenField().value = "api-newtoken";
      tokenField().dispatchEvent(new Event("change", { bubbles: true }));

      let event = await eventPromise;
      assert.equal(event.detail.type, "phabricator");
      assert.equal(event.detail.setting, "apiToken");
      assert.equal(event.detail.value, "api-newtoken");
    });

    it("should still emit booleans for the checkboxes", async function () {
      await element.updateComplete;

      let eventPromise = new Promise((resolve) => {
        element.addEventListener("setting-change", resolve, { once: true });
      });

      let checkbox = element.shadowRoot.getElementById("phabricator-enabled");
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));

      let event = await eventPromise;
      assert.equal(event.detail.value, true);
    });

    it("should report no token by default", async function () {
      await element.updateComplete;
      assert.ok(tokenStatus().textContent.includes("No API token set"));
    });

    it("should report a valid token with the account name", async function () {
      element.tokenState = PHABRICATOR_TOKEN_STATES.VALID;
      element.tokenUserName = "testuser";
      await element.updateComplete;

      assert.ok(tokenStatus().textContent.includes("testuser"));
    });

    it("should report a rejected token", async function () {
      element.tokenState = PHABRICATOR_TOKEN_STATES.INVALID;
      await element.updateComplete;

      assert.ok(tokenStatus().textContent.includes("rejected"));
    });

    it("should report while checking", async function () {
      element.tokenState = PHABRICATOR_TOKEN_STATES.CHECKING;
      await element.updateComplete;

      assert.ok(tokenStatus().textContent.includes("Checking"));
    });

    it("should hide the session option once a token is set", async function () {
      element.hasSession = true;
      element.apiToken = "api-token";
      await element.updateComplete;

      assert.notOk(
        element.shadowRoot.getElementById("phabricator-enabled"),
        "Session checkbox should be gone"
      );
      assert.notOk(
        element.shadowRoot.getElementById("phabricator-session-status"),
        "Session status should be gone with it"
      );
    });

    it("should keep the reviewer groups checkbox with a token set", async function () {
      element.apiToken = "api-token";
      await element.updateComplete;

      let checkboxes = element.shadowRoot.querySelectorAll(
        'input[type="checkbox"]'
      );
      assert.equal(checkboxes.length, 1, "Only reviewer groups should remain");
      assert.equal(checkboxes[0].id, "include-reviewer-groups");
    });

    it("should bring the session option back when the token is cleared", async function () {
      element.container = true;
      element.apiToken = "api-token";
      await element.updateComplete;
      assert.notOk(element.shadowRoot.getElementById("phabricator-enabled"));

      element.apiToken = "";
      await element.updateComplete;

      let checkbox = element.shadowRoot.getElementById("phabricator-enabled");
      assert.ok(checkbox, "Session checkbox should be back");
      assert.ok(checkbox.checked, "And should still reflect the setting");
    });

    it("should link to the Phabricator token settings page", async function () {
      await element.updateComplete;

      let link = element.shadowRoot.querySelector(".token-help a");
      assert.include(link.href, "/settings/panel/apitokens/");
    });
  });

  describe("dashboard container", function () {
    const CONTAINERS = [
      { cookieStoreId: "firefox-container-1", name: "Work" },
      { cookieStoreId: "firefox-container-2", name: "Personal" }
    ];

    function picker() {
      return element.shadowRoot.getElementById("phabricator-container");
    }

    function unavailableNote() {
      return element.shadowRoot.getElementById(
        "phabricator-containers-unavailable"
      );
    }

    it("should not offer a container without a token", async function () {
      element.containersAvailable = true;
      element.containers = CONTAINERS;
      await element.updateComplete;

      assert.notOk(picker(), "Container picker belongs to the token path");
      assert.notOk(unavailableNote());
    });

    it("should explain when container tabs are turned off", async function () {
      element.apiToken = "api-token";
      element.containersAvailable = false;
      await element.updateComplete;

      assert.ok(unavailableNote());
      assert.notOk(picker());
    });

    it("should list containers once available", async function () {
      element.apiToken = "api-token";
      element.containersAvailable = true;
      element.containers = CONTAINERS;
      await element.updateComplete;

      let options = picker().querySelectorAll("option");
      assert.equal(options.length, 3, "No container, plus the two containers");
      assert.equal(options[0].value, "");
      assert.equal(options[1].value, "firefox-container-1");
      assert.equal(options[1].textContent.trim(), "Work");
    });

    it("should mark the configured container as selected", async function () {
      element.apiToken = "api-token";
      element.containersAvailable = true;
      element.containers = CONTAINERS;
      element.dashboardContainer = "firefox-container-2";
      await element.updateComplete;

      assert.equal(picker().value, "firefox-container-2");
    });

    it("should emit setting-change when a container is picked", async function () {
      element.apiToken = "api-token";
      element.containersAvailable = true;
      element.containers = CONTAINERS;
      await element.updateComplete;

      let eventPromise = new Promise((resolve) => {
        element.addEventListener("setting-change", resolve, { once: true });
      });

      picker().value = "firefox-container-1";
      picker().dispatchEvent(new Event("change", { bubbles: true }));

      let event = await eventPromise;
      assert.equal(event.detail.setting, "dashboardContainer");
      assert.equal(event.detail.value, "firefox-container-1");
    });

    it("should offer only 'no container' when the user has none", async function () {
      element.apiToken = "api-token";
      element.containersAvailable = true;
      element.containers = [];
      await element.updateComplete;

      let options = picker().querySelectorAll("option");
      assert.equal(options.length, 1);
      assert.equal(options[0].value, "");
    });
  });
});
