/* globals loadPage, changeFieldValue */

/**
 * Prepares the Options UI so that it's in the default empty state.
 */
async function setupBlank(browser) {
  browser.storage.local.get
    .withArgs("updateInterval")
    .returns(Promise.resolve({ updateInterval: DEFAULT_UPDATE_INTERVAL }));
  browser.storage.local.get.withArgs("services").returns(
    Promise.resolve({
      services: [
        {
          id: 1,
          type: "phabricator",
          settings: {
            container: 0,
            inclReviewerGroups: true
          }
        }
      ]
    })
  );
  browser.storage.local.get
    .withArgs({ workingHours: {} })
    .returns(Promise.resolve({}));
  browser.storage.local.get
    .withArgs(["needsGitHubMigration", "oldIgnoredRepos"])
    .returns(Promise.resolve({}));
  browser.runtime.sendMessage
    .withArgs({
      name: "check-for-phabricator-session"
    })
    .returns(Promise.resolve(false));
}

async function setupWithServices(browser) {
  browser.storage.local.get
    .withArgs("updateInterval")
    .returns(Promise.resolve({ updateInterval: DEFAULT_UPDATE_INTERVAL }));
  browser.storage.local.get.withArgs("services").returns(
    Promise.resolve({
      services: [
        {
          id: 1,
          type: "bugzilla",
          settings: {
            apiKey: "abc123"
          }
        },
        {
          id: 2,
          type: "github",
          settings: {
            username: "mikeconley"
          }
        },
        {
          id: 3,
          type: "phabricator",
          settings: {
            container: 0,
            inclReviewerGroups: true
          }
        }
      ]
    })
  );
  browser.storage.local.get
    .withArgs({ workingHours: {} })
    .returns(Promise.resolve({}));
  browser.storage.local.get
    .withArgs(["needsGitHubMigration", "oldIgnoredRepos"])
    .returns(Promise.resolve({}));
  browser.runtime.sendMessage
    .withArgs({
      name: "check-for-phabricator-session"
    })
    .returns(Promise.resolve(false));
}

describe("Options page", function () {
  it("should show stored interval time, and be able to update", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupBlank,
      test: async (content, document) => {
        let field = document.getElementById("update-interval");
        parseInt(field.value, 10).should.equal(DEFAULT_UPDATE_INTERVAL);

        // Now update the value
        let newInterval = DEFAULT_UPDATE_INTERVAL + 1;
        browser.storage.local.set
          .withArgs({
            updateInterval: undefined
          })
          .returns(Promise.resolve());
        changeFieldValue(field, newInterval);
        assert.ok(browser.storage.local.set.calledOnce);
        assert.ok(
          browser.storage.local.set.calledWith({
            updateInterval: newInterval
          })
        );
      }
    });
  });
});

describe("Options page", function () {
  it("should show and be able to update the Bugzilla API token", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupWithServices,
      test: async (content, document) => {
        const NEW_KEY = "xyz54321";
        let field = document.getElementById("bugzilla-apiKey");
        field.value.should.equal("abc123");

        // Now update the value
        changeFieldValue(field, NEW_KEY);
        browser.storage.local.set
          .withArgs({ services: undefined })
          .returns(Promise.resolve());

        assert.ok(browser.storage.local.set.calledOnce);
        assert.ok(
          browser.storage.local.set.calledWith({
            services: [
              {
                id: 1,
                type: "bugzilla",
                settings: {
                  apiKey: NEW_KEY
                }
              },
              {
                id: 2,
                type: "github",
                settings: {
                  username: "mikeconley"
                }
              },
              {
                id: 3,
                type: "phabricator",
                settings: {
                  container: 0,
                  inclReviewerGroups: true
                }
              }
            ]
          })
        );
      }
    });
  });

  it("should be able to update the needinfo state for Bugzilla", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupWithServices,
      test: async (content, document) => {
        let field = document.getElementById("bugzilla-needinfos");
        field.checked.should.equal(false);

        browser.storage.local.set
          .withArgs({ services: undefined })
          .returns(Promise.resolve());

        // Now update the value
        field.click();

        assert.ok(browser.storage.local.set.calledOnce);
        assert.ok(
          browser.storage.local.set.calledWith({
            services: [
              {
                id: 1,
                type: "bugzilla",
                settings: {
                  apiKey: "abc123",
                  needinfos: true
                }
              },
              {
                id: 2,
                type: "github",
                settings: {
                  username: "mikeconley"
                }
              },
              {
                id: 3,
                type: "phabricator",
                settings: {
                  container: 0,
                  inclReviewerGroups: true
                }
              }
            ]
          })
        );
      }
    });
  });

  it("should show and be able to update the GitHub username", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupWithServices,
      test: async (content, document) => {
        const NEW_USERNAME = "hoobastank";
        let field = document.getElementById("github-username");
        field.value.should.equal("mikeconley");

        // Now update the value
        changeFieldValue(field, NEW_USERNAME);
        browser.storage.local.set
          .withArgs({ services: undefined })
          .returns(Promise.resolve());

        assert.ok(browser.storage.local.set.calledOnce);
        assert.ok(
          browser.storage.local.set.calledWith({
            services: [
              {
                id: 1,
                type: "bugzilla",
                settings: {
                  apiKey: "abc123"
                }
              },
              {
                id: 2,
                type: "github",
                settings: {
                  username: "hoobastank"
                }
              },
              {
                id: 3,
                type: "phabricator",
                settings: {
                  container: 0,
                  inclReviewerGroups: true
                }
              }
            ]
          })
        );
      }
    });
  });
});

const WEEKENDS = ["saturday", "sunday"];

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

describe("Options page", function () {
  it("should be able to set working hours from default state", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupBlank,
      test: async (content, document) => {
        // By default, the working hours fields should be disabled.
        let fieldset = document.getElementById("working-hours-fields");
        assert.ok(fieldset.disabled);

        // Default workday is 9-5, in HH:MM.
        let startTime = document.getElementById("start-time").value;
        assert.equal(startTime, "09:00");
        let endTime = document.getElementById("end-time").value;
        assert.equal(endTime, "17:00");

        // Monday-Friday should be checked by default, weekends not checked.
        let boxes = fieldset.querySelectorAll("input[type='checkbox']");
        assert.equal(boxes.length, WEEKDAYS.length + WEEKENDS.length);
        for (let box of boxes) {
          if (WEEKDAYS.includes(box.id)) {
            assert.ok(box.checked);
          } else if (WEEKENDS.includes(box.id)) {
            assert.ok(!box.checked);
          } else {
            assert.ok(false, "Did not expect a checkbox with id: " + box.id);
          }
        }

        let checkbox = document.getElementById("working-hours-checkbox");
        checkbox.click();
        assert.ok(!fieldset.hasAttribute("disabled"));

        assert.ok(browser.storage.local.set.calledOnce);
        assert.ok(
          browser.storage.local.set.calledWith({
            workingHours: {
              enabled: true,
              days: WEEKDAYS,
              startTime: "09:00",
              endTime: "17:00"
            }
          })
        );
      }
    });
  });
});

describe("GitHub migration", function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("should show migration warning when needsGitHubMigration is set", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: async (browser) => {
        await setupWithServices(browser);
        browser.storage.local.get
          .withArgs(["needsGitHubMigration", "oldIgnoredRepos"])
          .returns(
            Promise.resolve({
              needsGitHubMigration: true,
              oldIgnoredRepos: "mozilla, taskcluster"
            })
          );
      },
      test: async (content, document) => {
        let warning = document.getElementById("github-migration-warning");
        assert.ok(!warning.classList.contains("hidden"));

        let oldReposSpan = document.getElementById("old-repos");
        assert.equal(oldReposSpan.textContent, "mozilla, taskcluster");
      }
    });
  });

  it("should keep warning hidden when migration is not needed", async () => {
    browser.storage.local.get
      .withArgs(["needsGitHubMigration", "oldIgnoredRepos"])
      .returns(Promise.resolve({}));

    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupWithServices,
      test: async (content, document) => {
        let warning = document.getElementById("github-migration-warning");
        assert.ok(warning.classList.contains("hidden"));
      }
    });
  });

  it("should show dialog with repos when migration helper is clicked", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: async (browser) => {
        await setupWithServices(browser);
        browser.storage.local.get
          .withArgs(["needsGitHubMigration", "oldIgnoredRepos"])
          .returns(
            Promise.resolve({
              needsGitHubMigration: true,
              oldIgnoredRepos: "mozilla"
            })
          );
      },
      test: async (content, document) => {
        sandbox.stub(content, "fetch").resolves({
          ok: true,
          json: async () => ({
            items: [
              {
                repository_url: "https://api.github.com/repos/mozilla/gecko-dev"
              },
              { repository_url: "https://api.github.com/repos/rust-lang/rust" }
            ]
          })
        });

        let helpButton = document.getElementById("help-migrate");
        helpButton.click();

        await new Promise((resolve) => setTimeout(resolve, 200));

        let dialog = document.querySelector("#migration-dialog");
        assert.ok(dialog);
        assert.ok(dialog.open);

        let checkboxes = dialog.querySelectorAll("input[type='checkbox']");
        assert.equal(checkboxes.length, 2);
        assert.equal(checkboxes[0].value, "mozilla/gecko-dev");
        assert.equal(checkboxes[1].value, "rust-lang/rust");
      }
    });
  });

  it("should save selected repos when save button is clicked", async () => {
    browser.storage.local.remove.returns(Promise.resolve());

    await loadPage({
      url: "/addon/content/options/options.html",
      setup: async (browser) => {
        await setupWithServices(browser);
        browser.storage.local.get
          .withArgs(["needsGitHubMigration", "oldIgnoredRepos"])
          .returns(
            Promise.resolve({
              needsGitHubMigration: true,
              oldIgnoredRepos: "mozilla"
            })
          );
      },
      test: async (content, document) => {
        sandbox.stub(content, "fetch").resolves({
          ok: true,
          json: async () => ({
            items: [
              {
                repository_url: "https://api.github.com/repos/mozilla/gecko-dev"
              },
              { repository_url: "https://api.github.com/repos/rust-lang/rust" }
            ]
          })
        });

        let helpButton = document.getElementById("help-migrate");
        helpButton.click();

        await new Promise((resolve) => setTimeout(resolve, 200));

        let dialog = document.querySelector("#migration-dialog");
        let checkboxes = dialog.querySelectorAll("input[type='checkbox']");
        checkboxes[0].checked = true;
        checkboxes[1].checked = true;

        let saveButton = document.getElementById("save-migration");
        saveButton.click();

        await new Promise((resolve) => setTimeout(resolve, 200));

        let ignoredReposField = document.getElementById("github-ignored-repos");
        assert.equal(
          ignoredReposField.value,
          "mozilla/gecko-dev, rust-lang/rust"
        );

        assert.ok(
          browser.storage.local.remove.calledWith([
            "needsGitHubMigration",
            "oldIgnoredRepos"
          ])
        );

        let warning = document.getElementById("github-migration-warning");
        assert.ok(warning.classList.contains("hidden"));

        assert.ok(!dialog.open);
      }
    });
  });

  it("should close dialog when cancel button is clicked", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: async (browser) => {
        await setupWithServices(browser);
        browser.storage.local.get
          .withArgs(["needsGitHubMigration", "oldIgnoredRepos"])
          .returns(
            Promise.resolve({
              needsGitHubMigration: true,
              oldIgnoredRepos: "mozilla"
            })
          );
      },
      test: async (content, document) => {
        sandbox.stub(content, "fetch").resolves({
          ok: true,
          json: async () => ({
            items: [
              {
                repository_url: "https://api.github.com/repos/mozilla/gecko-dev"
              }
            ]
          })
        });

        let helpButton = document.getElementById("help-migrate");
        helpButton.click();

        await new Promise((resolve) => setTimeout(resolve, 200));

        let dialog = document.querySelector("#migration-dialog");
        assert.ok(dialog.open);

        let cancelButton = document.getElementById("cancel-migration");
        cancelButton.click();

        assert.ok(!dialog.open);
      }
    });
  });

  it("should alert if no GitHub username configured", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: async (browser) => {
        browser.storage.local.get
          .withArgs("updateInterval")
          .returns(
            Promise.resolve({ updateInterval: DEFAULT_UPDATE_INTERVAL })
          );
        browser.storage.local.get.withArgs("services").returns(
          Promise.resolve({
            services: [
              {
                id: 2,
                type: "github",
                settings: {}
              }
            ]
          })
        );
        browser.storage.local.get
          .withArgs({ workingHours: {} })
          .returns(Promise.resolve({}));
        browser.storage.local.get
          .withArgs(["needsGitHubMigration", "oldIgnoredRepos"])
          .returns(
            Promise.resolve({
              needsGitHubMigration: true,
              oldIgnoredRepos: "mozilla"
            })
          );
        browser.runtime.sendMessage
          .withArgs({
            name: "check-for-phabricator-session"
          })
          .returns(Promise.resolve(false));
      },
      test: async (content, document) => {
        let alertStub = sandbox.stub(content, "alert");

        let helpButton = document.getElementById("help-migrate");
        helpButton.click();

        await new Promise((resolve) => setTimeout(resolve, 100));

        assert.ok(alertStub.calledOnce);

        let dialog = document.querySelector("#migration-dialog");
        assert.ok(!dialog);
      }
    });
  });
});
