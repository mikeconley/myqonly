/* globals loadPage, changeFieldValue */

/**
 * Prepares the Options UI so that it's in the default empty state.
 */
async function setupBlank(browser) {
  browser.storage.local.get.withArgs("updateInterval").returns(
    Promise.resolve({ updateInterval: DEFAULT_UPDATE_INTERVAL, })
  );
  browser.storage.local.get.withArgs("services").returns(
    Promise.resolve({
      services: [{
        id: 1,
        type: "phabricator",
        settings: {
          container: 0,
          inclReviewerGroups: true,
        },
      },],
    })
  );
  browser.storage.local.get.withArgs({ workingHours: {}, }).returns(
    Promise.resolve({})
  );
  browser.runtime.sendMessage.withArgs({
    name: "check-for-phabricator-session",
  }).returns(
    Promise.resolve(false)
  );
}

async function setupWithServices(browser) {
  browser.storage.local.get.withArgs("updateInterval").returns(
    Promise.resolve({ updateInterval: DEFAULT_UPDATE_INTERVAL, })
  );
  browser.storage.local.get.withArgs("services").returns(
    Promise.resolve({
      services: [{
        id: 1,
        type: "bugzilla",
        settings: {
          apiKey: "abc123",
        },
      }, {
        id: 2,
        type: "github",
        settings: {
          username: "mikeconley",
        },
      },{
        id: 3,
        type: "phabricator",
        settings: {
          container: 0,
          inclReviewerGroups: true,
        },
      },],
    })
  );
  browser.storage.local.get.withArgs({ workingHours: {}, }).returns(
    Promise.resolve({})
  );
  browser.runtime.sendMessage.withArgs({
    name: "check-for-phabricator-session",
  }).returns(
    Promise.resolve(false)
  );
}


describe("Options page", function() {
  it("should show stored interval time, and be able to update", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupBlank,
      test: async(content, document) => {
        let field = document.getElementById("update-interval");
        parseInt(field.value, 10).should.equal(DEFAULT_UPDATE_INTERVAL);

        // Now update the value
        let newInterval = DEFAULT_UPDATE_INTERVAL + 1;
        browser.storage.local.set.withArgs({
          updateInterval: undefined,
        }).returns(
          Promise.resolve()
        );
        changeFieldValue(field, newInterval);
        assert.ok(browser.storage.local.set.calledOnce);
        assert.ok(browser.storage.local.set.calledWith({
          updateInterval: newInterval,
        }));
      },
    });
  });
});

describe("Options page", function() {
  it("should show and be able to update the Bugzilla API token", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupWithServices,
      test: async(content, document) => {
        const NEW_KEY = "xyz54321";
        let field = document.getElementById("bugzilla-apiKey");
        field.value.should.equal("abc123");

        // Now update the value
        changeFieldValue(field, NEW_KEY);
        browser.storage.local.set.withArgs({ services: undefined, }).returns(
          Promise.resolve()
        );

        assert.ok(browser.storage.local.set.calledOnce);
        assert.ok(browser.storage.local.set.calledWith({
          services: [{
            id: 1,
            type: "bugzilla",
            settings: {
              apiKey: NEW_KEY,
            },
          }, {
            id: 2,
            type: "github",
            settings: {
              username: "mikeconley",
            },
          }, {
            id: 3,
            type: "phabricator",
            settings: {
              container: 0,
              inclReviewerGroups: true,
            },
          },],
        }));
      },
    });
  });

  it("should be able to update the needinfo state for Bugzilla", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupWithServices,
      test: async(content, document) => {
        let field = document.getElementById("bugzilla-needinfos");
        field.checked.should.equal(false);

        browser.storage.local.set.withArgs({ services: undefined, }).returns(
          Promise.resolve()
        );

        // Now update the value
        field.click();

        assert.ok(browser.storage.local.set.calledOnce);
        assert.ok(browser.storage.local.set.calledWith({
          services: [{
            id: 1,
            type: "bugzilla",
            settings: {
              apiKey: "abc123",
              needinfos: true,
            },
          }, {
            id: 2,
            type: "github",
            settings: {
              username: "mikeconley",
            },
          }, {
            id: 3,
            type: "phabricator",
            settings: {
              container: 0,
              inclReviewerGroups: true,
            },
          },],
        }));
      },
    });
  });

  it("should be able to update the all flags state for Bugzilla", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupWithServices,
      test: async(content, document) => {
        let field = document.getElementById("bugzilla-allBugzillaFlags");
        field.checked.should.equal(false);

        browser.storage.local.set.withArgs({ services: undefined, }).returns(
          Promise.resolve()
        );

        // Now update the value
        field.click();

        assert.ok(browser.storage.local.set.calledOnce);
        assert.ok(browser.storage.local.set.calledWith({
          services: [{
            id: 1,
            type: "bugzilla",
            settings: {
              apiKey: "abc123",
              allBugzillaFlags: true,
            },
          }, {
            id: 2,
            type: "github",
            settings: {
              username: "mikeconley",
            },
          }, {
            id: 3,
            type: "phabricator",
            settings: {
              container: 0,
            },
          },],
        }));
      },
    });
  });

  it("should show and be able to update the GitHub username", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupWithServices,
      test: async(content, document) => {
        const NEW_USERNAME = "hoobastank";
        let field = document.getElementById("github-username");
        field.value.should.equal("mikeconley");

        // Now update the value
        changeFieldValue(field, NEW_USERNAME);
        browser.storage.local.set.withArgs({ services: undefined, }).returns(
          Promise.resolve()
        );

        assert.ok(browser.storage.local.set.calledOnce);
        assert.ok(browser.storage.local.set.calledWith({
          services: [{
            id: 1,
            type: "bugzilla",
            settings: {
              apiKey: "abc123",
            },
          }, {
            id: 2,
            type: "github",
            settings: {
              username: "hoobastank",
            },
          }, {
            id: 3,
            type: "phabricator",
            settings: {
              container: 0,
              inclReviewerGroups: true,
            },
          },],
        }));
      },
    });
  });
});

const WEEKENDS = [
  "saturday",
  "sunday",
];

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
];

describe("Options page", function() {
  it("should be able to set working hours from default state", async () => {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: setupBlank,
      test: async(content, document) => {
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
        assert.ok(browser.storage.local.set.calledWith({
          workingHours: {
            enabled: true,
            days: WEEKDAYS,
            startTime: "09:00",
            endTime: "17:00",
          },
        }));
      },
    });
  });
});
