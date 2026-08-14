import {
  DEFAULT_UPDATE_INTERVAL,
  MESSAGE_TYPES,
  PHABRICATOR_TOKEN_STATES
} from "../../addon/constants.mjs";
import { loadPage, changeFieldValue } from "../test-utils.mjs";

const browser = window.chrome;

/**
 * Gets the options-page element's shadow root.
 */
function getOptionsPage(document) {
  return document.querySelector("options-page");
}

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
    .withArgs({
      workingHours: {
        enabled: false,
        startTime: "09:00",
        endTime: "17:00",
        days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
      }
    })
    .returns(
      Promise.resolve({
        workingHours: {
          enabled: false,
          startTime: "09:00",
          endTime: "17:00",
          days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
        }
      })
    );
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
    .withArgs({
      workingHours: {
        enabled: false,
        startTime: "09:00",
        endTime: "17:00",
        days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
      }
    })
    .returns(
      Promise.resolve({
        workingHours: {
          enabled: false,
          startTime: "09:00",
          endTime: "17:00",
          days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
        }
      })
    );
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
        let optionsPage = getOptionsPage(document);
        let field = optionsPage.shadowRoot.querySelector(
          'input[type="number"]'
        );
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

describe("Options page Phabricator token", function () {
  /**
   * Loads the options page with a Phabricator service carrying apiToken, and
   * with the token validation message answering `validation`.
   */
  async function loadWithToken(apiToken, validation, test) {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: async (browser) => {
        await setupBlank(browser);
        browser.storage.local.get.withArgs("services").returns(
          Promise.resolve({
            services: [
              {
                id: 1,
                type: "phabricator",
                settings: { container: 0, inclReviewerGroups: true, apiToken }
              }
            ]
          })
        );
        browser.runtime.sendMessage
          .withArgs({ name: MESSAGE_TYPES.VALIDATE_PHABRICATOR_TOKEN })
          .returns(Promise.resolve(validation));
      },
      test
    });
  }

  function getPhabConfig(document) {
    return getOptionsPage(document).shadowRoot.querySelector(
      "phabricator-config"
    );
  }

  it("should show a validated token's account name", async () => {
    await loadWithToken(
      "api-goodtoken",
      { valid: true, userName: "testuser" },
      async (content, document) => {
        let phabConfig = getPhabConfig(document);
        await phabConfig.updateComplete;

        assert.equal(phabConfig.apiToken, "api-goodtoken");
        assert.equal(phabConfig.tokenState, PHABRICATOR_TOKEN_STATES.VALID);
        assert.equal(phabConfig.tokenUserName, "testuser");
      }
    );
  });

  it("should mark a rejected token invalid", async () => {
    await loadWithToken(
      "api-badtoken",
      { valid: false, error: "ERR-INVALID-AUTH" },
      async (content, document) => {
        let phabConfig = getPhabConfig(document);
        await phabConfig.updateComplete;

        assert.equal(phabConfig.tokenState, PHABRICATOR_TOKEN_STATES.INVALID);
      }
    );
  });

  it("should not fetch the dashboard for a session when a token is set", async () => {
    await loadWithToken(
      "api-goodtoken",
      { valid: true, userName: "testuser" },
      async () => {
        assert.ok(
          !browser.runtime.sendMessage.calledWith({
            name: MESSAGE_TYPES.CHECK_PHABRICATOR_SESSION
          }),
          "Session check is wasted work on the token path"
        );
      }
    );
  });

  it("should still check for a session with no token", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupBlank,
      test: async () => {
        assert.ok(
          browser.runtime.sendMessage.calledWith({
            name: MESSAGE_TYPES.CHECK_PHABRICATOR_SESSION
          }),
          "Scraping path still needs the session check"
        );
      }
    });
  });

  it("should not validate when no token is configured", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupBlank,
      test: async (content, document) => {
        let phabConfig = getPhabConfig(document);
        await phabConfig.updateComplete;

        assert.equal(phabConfig.tokenState, PHABRICATOR_TOKEN_STATES.UNSET);
        assert.ok(
          !browser.runtime.sendMessage.calledWith({
            name: MESSAGE_TYPES.VALIDATE_PHABRICATOR_TOKEN
          }),
          "Should not have asked to validate a token that is not set"
        );
      }
    });
  });

  it("should persist and re-validate a token entered by the user", async () => {
    await loadWithToken(
      "",
      { valid: true, userName: "testuser" },
      async (content, document) => {
        let optionsPage = getOptionsPage(document);
        let phabConfig = getPhabConfig(document);
        let field = phabConfig.shadowRoot.getElementById(
          "phabricator-apiToken"
        );

        let checked = new Promise((resolve) => {
          document.addEventListener("phabricator-token-checked", resolve, {
            once: true
          });
        });

        changeFieldValue(field, "api-newtoken");
        await checked;
        await optionsPage.updateComplete;

        // The options page also persists empty placeholder services for
        // bugzilla and github, so assert on the Phabricator entry only.
        let lastSet = browser.storage.local.set.lastCall.args[0];
        let stored = lastSet.services.find((s) => s.type == "phabricator");
        assert.deepEqual(
          stored.settings,
          {
            container: 0,
            inclReviewerGroups: true,
            apiToken: "api-newtoken"
          },
          "Should have stored the new token"
        );
        assert.equal(phabConfig.tokenState, PHABRICATOR_TOKEN_STATES.VALID);
      }
    );
  });
});

describe("Options page", function () {
  it("should show and be able to update the Bugzilla API token", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupWithServices,
      test: async (content, document) => {
        const NEW_KEY = "xyz54321";
        let optionsPage = getOptionsPage(document);
        let bugzillaConfig =
          optionsPage.shadowRoot.querySelector("bugzilla-config");
        let field = bugzillaConfig.shadowRoot.querySelector(
          'input[type="password"]'
        );
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
        let optionsPage = getOptionsPage(document);
        let bugzillaConfig =
          optionsPage.shadowRoot.querySelector("bugzilla-config");
        let checkboxes = bugzillaConfig.shadowRoot.querySelectorAll(
          'input[type="checkbox"]'
        );
        let field = checkboxes[0];
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
        let optionsPage = getOptionsPage(document);
        let githubConfig =
          optionsPage.shadowRoot.querySelector("github-config");
        let textInputs =
          githubConfig.shadowRoot.querySelectorAll('input[type="text"]');
        let field = textInputs[0];
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
        let optionsPage = getOptionsPage(document);
        let workingHoursConfig = optionsPage.shadowRoot.querySelector(
          "working-hours-config"
        );

        // By default, the working hours fields should be disabled.
        let fieldset = workingHoursConfig.shadowRoot.querySelector("fieldset");
        assert.ok(fieldset.disabled);

        // Default workday is 9-5, in HH:MM.
        let timeInputs =
          workingHoursConfig.shadowRoot.querySelectorAll('input[type="time"]');
        let startTime = timeInputs[0].value;
        assert.equal(startTime, "09:00");
        let endTime = timeInputs[1].value;
        assert.equal(endTime, "17:00");

        // Monday-Friday should be checked by default, weekends not checked.
        let boxes = fieldset.querySelectorAll("input[type='checkbox']");
        assert.equal(boxes.length, WEEKDAYS.length + WEEKENDS.length);
        for (let box of boxes) {
          let day = box.dataset.day;
          if (WEEKDAYS.includes(day)) {
            assert.ok(box.checked);
          } else if (WEEKENDS.includes(day)) {
            assert.ok(!box.checked);
          } else {
            assert.ok(false, "Did not expect a checkbox with day: " + day);
          }
        }

        let checkbox = workingHoursConfig.shadowRoot.querySelector(
          'input[type="checkbox"]'
        );
        checkbox.click();
        await workingHoursConfig.updateComplete;

        fieldset = workingHoursConfig.shadowRoot.querySelector("fieldset");
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
        let optionsPage = getOptionsPage(document);
        let migrationWarning =
          optionsPage.shadowRoot.querySelector("migration-warning");
        let warning = migrationWarning.shadowRoot.querySelector(".warning");
        assert.ok(!warning.classList.contains("hidden"));

        let oldReposCode =
          migrationWarning.shadowRoot.querySelectorAll("code")[1];
        assert.equal(oldReposCode.textContent, "mozilla, taskcluster");
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
        let optionsPage = getOptionsPage(document);
        let migrationWarning =
          optionsPage.shadowRoot.querySelector("migration-warning");
        let warning = migrationWarning.shadowRoot.querySelector(".warning");
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

        let optionsPage = getOptionsPage(document);
        let migrationWarning =
          optionsPage.shadowRoot.querySelector("migration-warning");
        let helpButton = migrationWarning.shadowRoot.querySelector("button");

        let dialogShownPromise = new Promise((resolve) => {
          let observer = new MutationObserver(() => {
            let dialog = optionsPage.shadowRoot.querySelector("dialog");
            if (dialog) {
              observer.disconnect();
              resolve(dialog);
            }
          });
          observer.observe(optionsPage.shadowRoot, {
            childList: true,
            subtree: true
          });
        });

        helpButton.click();

        let dialog = await dialogShownPromise;
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

        let optionsPage = getOptionsPage(document);
        let migrationWarning =
          optionsPage.shadowRoot.querySelector("migration-warning");
        let helpButton = migrationWarning.shadowRoot.querySelector("button");

        let dialogShownPromise = new Promise((resolve) => {
          let observer = new MutationObserver(() => {
            let dialog = optionsPage.shadowRoot.querySelector("dialog");
            if (dialog) {
              observer.disconnect();
              resolve(dialog);
            }
          });
          observer.observe(optionsPage.shadowRoot, {
            childList: true,
            subtree: true
          });
        });

        helpButton.click();

        let dialog = await dialogShownPromise;
        let checkboxes = dialog.querySelectorAll("input[type='checkbox']");
        checkboxes[0].checked = true;
        checkboxes[1].checked = true;

        let saveButton = dialog.querySelector("#save-migration");
        saveButton.click();

        await optionsPage.updateComplete;
        let githubConfig =
          optionsPage.shadowRoot.querySelector("github-config");
        await githubConfig.updateComplete;

        let textInputs =
          githubConfig.shadowRoot.querySelectorAll('input[type="text"]');
        let ignoredReposField = textInputs[textInputs.length - 1];
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

        let warning = migrationWarning.shadowRoot.querySelector(".warning");
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

        let optionsPage = getOptionsPage(document);
        let migrationWarning =
          optionsPage.shadowRoot.querySelector("migration-warning");
        let helpButton = migrationWarning.shadowRoot.querySelector("button");

        let dialogShownPromise = new Promise((resolve) => {
          let observer = new MutationObserver(() => {
            let dialog = optionsPage.shadowRoot.querySelector("dialog");
            if (dialog) {
              observer.disconnect();
              resolve(dialog);
            }
          });
          observer.observe(optionsPage.shadowRoot, {
            childList: true,
            subtree: true
          });
        });

        helpButton.click();

        let dialog = await dialogShownPromise;
        assert.ok(dialog.open);

        let cancelButton = dialog.querySelector("#cancel-migration");
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
          .withArgs({
            workingHours: {
              enabled: false,
              startTime: "09:00",
              endTime: "17:00",
              days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
            }
          })
          .returns(
            Promise.resolve({
              workingHours: {
                enabled: false,
                startTime: "09:00",
                endTime: "17:00",
                days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
              }
            })
          );
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

        let optionsPage = getOptionsPage(document);
        let migrationWarning =
          optionsPage.shadowRoot.querySelector("migration-warning");
        let helpButton = migrationWarning.shadowRoot.querySelector("button");

        helpButton.click();

        await optionsPage.updateComplete;

        assert.ok(alertStub.calledOnce);

        let dialog = optionsPage.shadowRoot.querySelector("dialog");
        assert.ok(!dialog);
      }
    });
  });

  it("should clear migration warning when ignoredRepos is cleared", async () => {
    browser.storage.local.remove.returns(Promise.resolve());

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
                settings: {
                  username: "testuser",
                  ignoredRepos: "mozilla"
                }
              }
            ]
          })
        );
        browser.storage.local.get
          .withArgs({
            workingHours: {
              enabled: false,
              startTime: "09:00",
              endTime: "17:00",
              days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
            }
          })
          .returns(
            Promise.resolve({
              workingHours: {
                enabled: false,
                startTime: "09:00",
                endTime: "17:00",
                days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
              }
            })
          );
        browser.storage.local.get
          .withArgs(["needsGitHubMigration", "oldIgnoredRepos"])
          .returns(
            Promise.resolve({
              needsGitHubMigration: true,
              oldIgnoredRepos: "mozilla"
            })
          );
        browser.storage.local.get
          .withArgs("needsGitHubMigration")
          .returns(Promise.resolve({ needsGitHubMigration: true }));
        browser.runtime.sendMessage
          .withArgs({
            name: "check-for-phabricator-session"
          })
          .returns(Promise.resolve(false));
      },
      test: async (content, document) => {
        let optionsPage = getOptionsPage(document);
        let migrationWarning =
          optionsPage.shadowRoot.querySelector("migration-warning");
        let warning = migrationWarning.shadowRoot.querySelector(".warning");
        assert.ok(!warning.classList.contains("hidden"));

        let githubConfig =
          optionsPage.shadowRoot.querySelector("github-config");
        let textInputs =
          githubConfig.shadowRoot.querySelectorAll('input[type="text"]');
        let field = textInputs[textInputs.length - 1];
        assert.equal(field.value, "mozilla");

        let eventPromise = new Promise((resolve) => {
          document.addEventListener("migration-check-complete", resolve, {
            once: true
          });
        });

        changeFieldValue(field, "");

        await eventPromise;
        await migrationWarning.updateComplete;

        warning = migrationWarning.shadowRoot.querySelector(".warning");
        assert.ok(
          browser.storage.local.remove.calledWith([
            "needsGitHubMigration",
            "oldIgnoredRepos"
          ])
        );
        assert.ok(warning.classList.contains("hidden"));
      }
    });
  });

  it("should clear migration warning when changed to new format", async () => {
    browser.storage.local.remove.returns(Promise.resolve());

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
                settings: {
                  username: "testuser",
                  ignoredRepos: "mozilla"
                }
              }
            ]
          })
        );
        browser.storage.local.get
          .withArgs({
            workingHours: {
              enabled: false,
              startTime: "09:00",
              endTime: "17:00",
              days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
            }
          })
          .returns(
            Promise.resolve({
              workingHours: {
                enabled: false,
                startTime: "09:00",
                endTime: "17:00",
                days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
              }
            })
          );
        browser.storage.local.get
          .withArgs(["needsGitHubMigration", "oldIgnoredRepos"])
          .returns(
            Promise.resolve({
              needsGitHubMigration: true,
              oldIgnoredRepos: "mozilla"
            })
          );
        browser.storage.local.get
          .withArgs("needsGitHubMigration")
          .returns(Promise.resolve({ needsGitHubMigration: true }));
        browser.runtime.sendMessage
          .withArgs({
            name: "check-for-phabricator-session"
          })
          .returns(Promise.resolve(false));
      },
      test: async (content, document) => {
        let optionsPage = getOptionsPage(document);
        let migrationWarning =
          optionsPage.shadowRoot.querySelector("migration-warning");
        let warning = migrationWarning.shadowRoot.querySelector(".warning");
        assert.ok(!warning.classList.contains("hidden"));

        let githubConfig =
          optionsPage.shadowRoot.querySelector("github-config");
        let textInputs =
          githubConfig.shadowRoot.querySelectorAll('input[type="text"]');
        let field = textInputs[textInputs.length - 1];

        let eventPromise = new Promise((resolve) => {
          document.addEventListener("migration-check-complete", resolve, {
            once: true
          });
        });

        changeFieldValue(field, "mozilla/gecko-dev");

        await eventPromise;
        await migrationWarning.updateComplete;

        warning = migrationWarning.shadowRoot.querySelector(".warning");
        assert.ok(
          browser.storage.local.remove.calledWith([
            "needsGitHubMigration",
            "oldIgnoredRepos"
          ])
        );
        assert.ok(warning.classList.contains("hidden"));
      }
    });
  });

  it("should not clear migration warning if still has old format repos", async () => {
    browser.storage.local.remove.returns(Promise.resolve());

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
                settings: {
                  username: "testuser",
                  ignoredRepos: "mozilla"
                }
              }
            ]
          })
        );
        browser.storage.local.get
          .withArgs({
            workingHours: {
              enabled: false,
              startTime: "09:00",
              endTime: "17:00",
              days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
            }
          })
          .returns(
            Promise.resolve({
              workingHours: {
                enabled: false,
                startTime: "09:00",
                endTime: "17:00",
                days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
              }
            })
          );
        browser.storage.local.get
          .withArgs(["needsGitHubMigration", "oldIgnoredRepos"])
          .returns(
            Promise.resolve({
              needsGitHubMigration: true,
              oldIgnoredRepos: "mozilla"
            })
          );
        browser.storage.local.get
          .withArgs("needsGitHubMigration")
          .returns(Promise.resolve({ needsGitHubMigration: true }));
        browser.runtime.sendMessage
          .withArgs({
            name: "check-for-phabricator-session"
          })
          .returns(Promise.resolve(false));
      },
      test: async (content, document) => {
        let optionsPage = getOptionsPage(document);
        let migrationWarning =
          optionsPage.shadowRoot.querySelector("migration-warning");
        let warning = migrationWarning.shadowRoot.querySelector(".warning");
        assert.ok(!warning.classList.contains("hidden"));

        let githubConfig =
          optionsPage.shadowRoot.querySelector("github-config");
        let textInputs =
          githubConfig.shadowRoot.querySelectorAll('input[type="text"]');
        let field = textInputs[textInputs.length - 1];

        changeFieldValue(field, "taskcluster");

        await optionsPage.updateComplete;

        assert.ok(!browser.storage.local.remove.called);
        assert.ok(!warning.classList.contains("hidden"));
      }
    });
  });
});
