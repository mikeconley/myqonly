import "../../../addon/content/options/bugzilla-config.mjs";

describe("BugzillaConfig Component", function () {
  let element;

  beforeEach(function () {
    element = document.createElement("bugzilla-config");
    document.body.appendChild(element);
  });

  afterEach(function () {
    element.remove();
  });

  it("should render with default values", async function () {
    await element.updateComplete;

    let passwordInput = element.shadowRoot.querySelector('input[type="password"]');
    assert.equal(passwordInput.value, "");

    let checkbox = element.shadowRoot.querySelector('input[type="checkbox"]');
    assert.ok(!checkbox.checked);
  });

  it("should display apiKey property", async function () {
    element.apiKey = "test-api-key-123";
    await element.updateComplete;

    let passwordInput = element.shadowRoot.querySelector('input[type="password"]');
    assert.equal(passwordInput.value, "test-api-key-123");
  });

  it("should display needinfos property", async function () {
    element.needinfos = true;
    await element.updateComplete;

    let checkbox = element.shadowRoot.querySelector('input[type="checkbox"]');
    assert.ok(checkbox.checked);
  });

  it("should emit setting-change when apiKey changes", async function () {
    await element.updateComplete;

    let eventPromise = new Promise((resolve) => {
      element.addEventListener("setting-change", resolve, { once: true });
    });

    let passwordInput = element.shadowRoot.querySelector('input[type="password"]');
    passwordInput.value = "new-api-key";
    passwordInput.dispatchEvent(new Event("change", { bubbles: true }));

    let event = await eventPromise;
    assert.equal(event.detail.type, "bugzilla");
    assert.equal(event.detail.setting, "apiKey");
    assert.equal(event.detail.value, "new-api-key");
    assert.ok(event.bubbles);
    assert.ok(event.composed);
  });

  it("should emit setting-change when needinfos changes", async function () {
    await element.updateComplete;

    let eventPromise = new Promise((resolve) => {
      element.addEventListener("setting-change", resolve, { once: true });
    });

    let checkbox = element.shadowRoot.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));

    let event = await eventPromise;
    assert.equal(event.detail.type, "bugzilla");
    assert.equal(event.detail.setting, "needinfos");
    assert.equal(event.detail.value, true);
  });

  it("should emit checkbox value as false when unchecked", async function () {
    element.needinfos = true;
    await element.updateComplete;

    let eventPromise = new Promise((resolve) => {
      element.addEventListener("setting-change", resolve, { once: true });
    });

    let checkbox = element.shadowRoot.querySelector('input[type="checkbox"]');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));

    let event = await eventPromise;
    assert.equal(event.detail.value, false);
  });

  it("should update both properties", async function () {
    element.apiKey = "my-key";
    element.needinfos = true;
    await element.updateComplete;

    let passwordInput = element.shadowRoot.querySelector('input[type="password"]');
    assert.equal(passwordInput.value, "my-key");

    let checkbox = element.shadowRoot.querySelector('input[type="checkbox"]');
    assert.ok(checkbox.checked);
  });
});
