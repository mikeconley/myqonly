import "../../../addon/content/options/github-config.mjs";

describe("GitHubConfig Component", function () {
  let element;

  beforeEach(function () {
    element = document.createElement("github-config");
    document.body.appendChild(element);
  });

  afterEach(function () {
    element.remove();
  });

  it("should render with default values", async function () {
    await element.updateComplete;

    let textInputs = element.shadowRoot.querySelectorAll('input[type="text"]');
    assert.equal(textInputs.length, 4); // username, ignoredUsers, ignoredTeams, ignoredRepos
    assert.equal(textInputs[0].value, "");

    let passwordInput = element.shadowRoot.querySelector('input[type="password"]');
    assert.equal(passwordInput.value, "");
  });

  it("should display username property", async function () {
    element.username = "testuser";
    await element.updateComplete;

    let usernameInput = element.shadowRoot.querySelector('input[type="text"]');
    assert.equal(usernameInput.value, "testuser");
  });

  it("should emit setting-change when username changes", async function () {
    await element.updateComplete;

    let eventPromise = new Promise((resolve) => {
      element.addEventListener("setting-change", resolve, { once: true });
    });

    let input = element.shadowRoot.querySelector('input[type="text"]');
    input.value = "newuser";
    input.dispatchEvent(new Event("change", { bubbles: true }));

    let event = await eventPromise;
    assert.equal(event.detail.type, "github");
    assert.equal(event.detail.setting, "username");
    assert.equal(event.detail.value, "newuser");
    assert.ok(event.bubbles);
    assert.ok(event.composed);
  });

  it("should emit setting-change when token changes", async function () {
    await element.updateComplete;

    let eventPromise = new Promise((resolve) => {
      element.addEventListener("setting-change", resolve, { once: true });
    });

    let tokenInput = element.shadowRoot.querySelector('input[type="password"]');
    tokenInput.value = "ghp_test123";
    tokenInput.dispatchEvent(new Event("change", { bubbles: true }));

    let event = await eventPromise;
    assert.equal(event.detail.setting, "token");
    assert.equal(event.detail.value, "ghp_test123");
  });

  it("should emit setting-change when checkbox changes", async function () {
    await element.updateComplete;

    let eventPromise = new Promise((resolve) => {
      element.addEventListener("setting-change", resolve, { once: true });
    });

    let checkbox = element.shadowRoot.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));

    let event = await eventPromise;
    assert.equal(event.detail.setting, "ignoreOwnPrs");
    assert.equal(event.detail.value, true);
  });

  it("should validate ignoredRepos format on user input", async function () {
    await element.updateComplete;

    let textInputs = element.shadowRoot.querySelectorAll('input[type="text"]');
    let reposInput = textInputs[textInputs.length - 1];
    reposInput.value = "mozilla";
    reposInput.dispatchEvent(new Event("change", { bubbles: true }));

    await element.updateComplete;

    assert.ok(element.validationError);

    let errorDiv = element.shadowRoot.querySelector(".error");
    assert.ok(!errorDiv.classList.contains("hidden"));
  });

  it("should not show validation error for valid repos format", async function () {
    element.ignoredRepos = "mozilla/gecko-dev";
    await element.updateComplete;

    assert.ok(!element.validationError);

    let errorDiv = element.shadowRoot.querySelector(".error");
    assert.ok(errorDiv.classList.contains("hidden"));
  });

  it("should emit setting-change with validation on repos change", async function () {
    await element.updateComplete;

    let eventPromise = new Promise((resolve) => {
      element.addEventListener("setting-change", resolve, { once: true });
    });

    let textInputs = element.shadowRoot.querySelectorAll('input[type="text"]');
    let reposInput = textInputs[textInputs.length - 1];
    reposInput.value = "mozilla";
    reposInput.dispatchEvent(new Event("change", { bubbles: true }));

    let event = await eventPromise;
    assert.equal(event.detail.setting, "ignoredRepos");
    assert.equal(event.detail.value, "mozilla");

    await element.updateComplete;
    assert.ok(element.validationError);
  });

  it("should handle empty ignoredRepos", async function () {
    element.ignoredRepos = "";
    await element.updateComplete;

    assert.ok(!element.validationError);
  });

  it("should update multiple properties", async function () {
    element.username = "user1";
    element.token = "token1";
    element.ignoreOwnPrs = true;
    element.ignoreDraftPrs = true;
    element.ignoredUsers = "user2, user3";
    await element.updateComplete;

    let textInputs = element.shadowRoot.querySelectorAll('input[type="text"]');
    assert.equal(textInputs[0].value, "user1"); // username
    assert.equal(textInputs[1].value, "user2, user3"); // ignoredUsers

    let passwordInput = element.shadowRoot.querySelector('input[type="password"]');
    assert.equal(passwordInput.value, "token1");

    let checkboxes = element.shadowRoot.querySelectorAll('input[type="checkbox"]');
    assert.ok(checkboxes[0].checked); // ignoreOwnPrs
    assert.ok(checkboxes[1].checked); // ignoreDraftPrs
  });
});
