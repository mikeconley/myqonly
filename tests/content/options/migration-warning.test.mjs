import "../../../addon/content/options/migration-warning.mjs";

describe("MigrationWarning Component", function () {
  let element;

  beforeEach(function () {
    element = document.createElement("migration-warning");
    document.body.appendChild(element);
  });

  afterEach(function () {
    element.remove();
  });

  it("should be hidden by default", async function () {
    await element.updateComplete;
    let warning = element.shadowRoot.querySelector(".warning");
    assert.ok(warning.classList.contains("hidden"));
  });

  it("should show warning when visible is true", async function () {
    element.visible = true;
    element.oldRepos = "mozilla, taskcluster";
    await element.updateComplete;

    let warning = element.shadowRoot.querySelector(".warning");
    assert.ok(!warning.classList.contains("hidden"));
  });

  it("should display old repos value", async function () {
    element.visible = true;
    element.oldRepos = "mozilla, taskcluster";
    await element.updateComplete;

    let codeElements = element.shadowRoot.querySelectorAll("code");
    let oldReposCode = codeElements[1];
    assert.equal(oldReposCode.textContent, "mozilla, taskcluster");
  });

  it("should emit help-migrate event when button clicked", async function () {
    element.visible = true;
    await element.updateComplete;

    let eventPromise = new Promise((resolve) => {
      element.addEventListener("help-migrate", resolve, { once: true });
    });

    let button = element.shadowRoot.querySelector("button");
    button.click();

    let event = await eventPromise;
    assert.ok(event);
    assert.ok(event.bubbles);
    assert.ok(event.composed);
  });

  it("should hide warning when visible changes to false", async function () {
    element.visible = true;
    await element.updateComplete;

    let warning = element.shadowRoot.querySelector(".warning");
    assert.ok(!warning.classList.contains("hidden"));

    element.visible = false;
    await element.updateComplete;

    warning = element.shadowRoot.querySelector(".warning");
    assert.ok(warning.classList.contains("hidden"));
  });
});
