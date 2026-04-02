import { MyQOnly } from "../addon/background.mjs";
import {
  FEATURE_ALERT_REV,
  DEFAULT_UPDATE_INTERVAL,
  ALARM_NAME
} from "../addon/constants.mjs";

const browser = window.chrome;

describe("MyQOnly initting fresh", function () {
  let sandbox;

  beforeEach(async function () {
    sandbox = sinon.createSandbox();

    sandbox.stub(window, "fetch").resolves({
      ok: false,
      status: 500,
      text: async () =>
        "Mocked fetch - tests should not make real network calls"
    });

    browser.storage.local.get
      .withArgs("featureRev")
      .returns(Promise.resolve({}));
    browser.storage.local.set.returns(Promise.resolve({}));
    browser.storage.local.get
      .withArgs("updateInterval")
      .returns(Promise.resolve({}));
    browser.storage.local.get.withArgs("services").returns(Promise.resolve({}));
    browser.storage.local.get
      .withArgs("workingHours")
      .returns(Promise.resolve({}));
    browser.storage.local.get
      .withArgs("needsGitHubMigration")
      .returns(Promise.resolve({}));

    if (!browser.action) {
      browser.action = {
        setBadgeText: sinon.stub().returns(Promise.resolve()),
        setBadgeBackgroundColor: sinon.stub().returns(Promise.resolve())
      };
    }
  });

  afterEach(async function () {
    MyQOnly.uninit();
    browser.flush();
    sandbox.restore();
  });

  it("should exist, and be able to init with defaults", async () => {
    should.exist(MyQOnly);
    await MyQOnly.init();
    // Should have set up listeners (note: alarm listener is registered at module level, not in init)
    assert.ok(browser.storage.onChanged.addListener.calledOnce);
    assert.ok(browser.runtime.onMessage.addListener.calledOnce);

    assert.equal(MyQOnly.featureRev, FEATURE_ALERT_REV);
    assert.equal(MyQOnly.updateInterval, DEFAULT_UPDATE_INTERVAL);

    // We should default with the Phabricator service enabled
    assert.equal(MyQOnly.services.length, 1);
    assert.equal(MyQOnly.services[0].type, "phabricator");

    for (let service in MyQOnly.reviewTotals) {
      assert.equal(MyQOnly.reviewTotals[service], 0);
    }

    assert.ok(
      browser.storage.local.set.calledWith({
        featureRev: FEATURE_ALERT_REV
      })
    );
    assert.ok(
      browser.storage.local.set.calledWith({
        updateInterval: DEFAULT_UPDATE_INTERVAL
      })
    );
    assert.ok(
      browser.alarms.create.calledWith(ALARM_NAME, {
        periodInMinutes: DEFAULT_UPDATE_INTERVAL
      })
    );
  });

  it("should update badge when alarm fires", async () => {
    await MyQOnly.init();

    let updateBadgeStub = sinon.stub(MyQOnly, "updateBadge").resolves();

    await MyQOnly.onAlarm({ name: ALARM_NAME });

    // Verify updateBadge was called
    assert.ok(updateBadgeStub.calledOnce, "updateBadge should be called when alarm fires");

    updateBadgeStub.restore();
  });

  it("should not resolve onAlarm until updateBadge completes", async () => {
    await MyQOnly.init();

    let resolveBadge;
    let updateBadgeStub = sinon.stub(MyQOnly, "updateBadge").returns(
      new Promise(resolve => { resolveBadge = resolve; })
    );

    let alarmResolved = false;
    let alarmPromise = MyQOnly.onAlarm({ name: ALARM_NAME }).then(() => {
      alarmResolved = true;
    });

    assert.ok(!alarmResolved, "onAlarm should not have resolved yet");
    resolveBadge();
    await alarmPromise;
    assert.ok(alarmResolved, "onAlarm should resolve after updateBadge completes");

    updateBadgeStub.restore();
  });

  it("should not update badge when alarm fires with wrong name", async () => {
    await MyQOnly.init();

    let updateBadgeStub = sinon.stub(MyQOnly, "updateBadge").resolves();

    await MyQOnly.onAlarm({ name: "some-other-alarm" });

    // Verify updateBadge was NOT called
    assert.ok(updateBadgeStub.notCalled, "updateBadge should not be called for other alarms");

    updateBadgeStub.restore();
  });

  it("should give unique IDs when adding the Phabricator service", async () => {
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
          }
        ]
      })
    );

    await MyQOnly.init();

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
  });

  it(
    "should add the default Phabricator service for " + "new installs",
    async () => {
      browser.storage.local.get
        .withArgs("services")
        .returns(Promise.resolve({}));

      await MyQOnly.init();

      assert.ok(
        browser.storage.local.set.calledWith({
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
    }
  );

  it(
    "should default the Phabricator service to show the " +
      "review group count.",
    async () => {
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
                container: 0
              }
            }
          ]
        })
      );

      await MyQOnly.init();

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
  );

  it(
    "should not update review group configuration for Phabricator " +
      "if it was already set.",
    async () => {
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
                inclReviewerGroups: false
              }
            }
          ]
        })
      );

      await MyQOnly.init();

      let service = MyQOnly._getService("phabricator");
      assert(!service.settings.inclReviewerGroups);
    }
  );
});

describe("GitHub migration detection", function () {
  let sandbox;

  beforeEach(async function () {
    sandbox = sinon.createSandbox();

    sandbox.stub(window, "fetch").resolves({
      ok: false,
      status: 500,
      text: async () =>
        "Mocked fetch - tests should not make real network calls"
    });

    browser.storage.local.get
      .withArgs("featureRev")
      .returns(Promise.resolve({}));
    browser.storage.local.set.returns(Promise.resolve({}));
    browser.storage.local.get
      .withArgs("updateInterval")
      .returns(Promise.resolve({}));
    browser.storage.local.get
      .withArgs("workingHours")
      .returns(Promise.resolve({}));
    browser.storage.local.get
      .withArgs("needsGitHubMigration")
      .returns(Promise.resolve({}));

    if (!browser.action) {
      browser.action = {
        setBadgeText: sinon.stub().returns(Promise.resolve()),
        setBadgeBackgroundColor: sinon.stub().returns(Promise.resolve())
      };
    }
  });

  afterEach(async function () {
    MyQOnly.uninit();
    browser.flush();
    sandbox.restore();
  });

  it("should detect repos in old format without slash", async () => {
    browser.storage.local.get.withArgs("services").returns(
      Promise.resolve({
        services: [
          {
            id: 1,
            type: "github",
            settings: {
              username: "testuser",
              ignoredRepos: "mozilla, taskcluster"
            }
          }
        ]
      })
    );

    await MyQOnly.init();

    assert.ok(
      browser.storage.local.set.calledWith({
        needsGitHubMigration: true,
        oldIgnoredRepos: "mozilla, taskcluster"
      })
    );
  });

  it("should not flag repos already in owner/repo format", async () => {
    browser.storage.local.get.withArgs("services").returns(
      Promise.resolve({
        services: [
          {
            id: 1,
            type: "github",
            settings: {
              username: "testuser",
              ignoredRepos: "mozilla/gecko-dev, rust-lang/rust"
            }
          }
        ]
      })
    );

    await MyQOnly.init();

    assert.ok(
      !browser.storage.local.set.calledWith({
        needsGitHubMigration: true,
        oldIgnoredRepos: "mozilla/gecko-dev, rust-lang/rust"
      })
    );
  });

  it("should detect mixed format with at least one old format repo", async () => {
    browser.storage.local.get.withArgs("services").returns(
      Promise.resolve({
        services: [
          {
            id: 1,
            type: "github",
            settings: {
              username: "testuser",
              ignoredRepos: "mozilla/gecko-dev, taskcluster"
            }
          }
        ]
      })
    );

    await MyQOnly.init();

    assert.ok(
      browser.storage.local.set.calledWith({
        needsGitHubMigration: true,
        oldIgnoredRepos: "mozilla/gecko-dev, taskcluster"
      })
    );
  });

  it("should not flag if ignoredRepos is empty", async () => {
    browser.storage.local.get.withArgs("services").returns(
      Promise.resolve({
        services: [
          {
            id: 1,
            type: "github",
            settings: {
              username: "testuser",
              ignoredRepos: ""
            }
          }
        ]
      })
    );

    await MyQOnly.init();

    assert.ok(
      !browser.storage.local.set.calledWith({
        needsGitHubMigration: true,
        oldIgnoredRepos: ""
      })
    );
  });

  it("should not flag if ignoredRepos is not set", async () => {
    browser.storage.local.get.withArgs("services").returns(
      Promise.resolve({
        services: [
          {
            id: 1,
            type: "github",
            settings: {
              username: "testuser"
            }
          }
        ]
      })
    );

    await MyQOnly.init();

    let setCallsWithMigrationFlag = browser.storage.local.set
      .getCalls()
      .filter((call) => call.args[0] && call.args[0].needsGitHubMigration);

    assert.equal(setCallsWithMigrationFlag.length, 0);
  });

  it("should not re-flag if already flagged", async () => {
    browser.storage.local.get
      .withArgs("needsGitHubMigration")
      .returns(Promise.resolve({ needsGitHubMigration: true }));
    browser.storage.local.get.withArgs("services").returns(
      Promise.resolve({
        services: [
          {
            id: 1,
            type: "github",
            settings: {
              username: "testuser",
              ignoredRepos: "mozilla"
            }
          }
        ]
      })
    );

    await MyQOnly.init();

    let setCallsWithMigrationFlag = browser.storage.local.set
      .getCalls()
      .filter((call) => call.args[0].needsGitHubMigration);

    assert.equal(setCallsWithMigrationFlag.length, 0);
  });

  it("should not error if GitHub service does not exist", async () => {
    browser.storage.local.get.withArgs("services").returns(
      Promise.resolve({
        services: [
          {
            id: 1,
            type: "bugzilla",
            settings: {
              apiKey: "abc123"
            }
          }
        ]
      })
    );

    await MyQOnly.init();

    let setCallsWithMigrationFlag = browser.storage.local.set
      .getCalls()
      .filter((call) => call.args[0] && call.args[0].needsGitHubMigration);

    assert.equal(setCallsWithMigrationFlag.length, 0);
  });
});

describe("State persistence", function () {
  let sandbox;

  beforeEach(async function () {
    sandbox = sinon.createSandbox();

    sandbox.stub(window, "fetch").resolves({
      ok: false,
      status: 500,
      text: async () =>
        "Mocked fetch - tests should not make real network calls"
    });

    browser.storage.local.get
      .withArgs("featureRev")
      .returns(Promise.resolve({}));
    browser.storage.local.set.returns(Promise.resolve({}));
    browser.storage.local.get
      .withArgs("updateInterval")
      .returns(Promise.resolve({}));
    browser.storage.local.get
      .withArgs("workingHours")
      .returns(Promise.resolve({}));
    browser.storage.local.get
      .withArgs("needsGitHubMigration")
      .returns(Promise.resolve({}));

    if (!browser.action) {
      browser.action = {
        setBadgeText: sinon.stub().returns(Promise.resolve()),
        setBadgeBackgroundColor: sinon.stub().returns(Promise.resolve())
      };
    }
  });

  afterEach(async function () {
    MyQOnly.uninit();
    browser.flush();
    sandbox.restore();
  });

  it("should persist states to storage after updateBadge()", async () => {
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
          },
          {
            id: 2,
            type: "github",
            settings: {
              username: "testuser"
            }
          }
        ]
      })
    );

    await MyQOnly.init();
    await MyQOnly.updateBadge();

    // Verify that storage.set was called with reviewStates
    const setCall = browser.storage.local.set
      .getCalls()
      .find((call) => call.args[0].hasOwnProperty("reviewStates"));

    assert.ok(setCall, "reviewStates should be saved to storage");

    // Verify the format is correct (array of entries)
    const reviewStates = setCall.args[0].reviewStates;
    assert.ok(Array.isArray(reviewStates), "reviewStates should be an array");

    // Should have entries for both services
    assert.equal(reviewStates.length, 2, "Should have 2 state entries");

    // Each entry should be [id, state] format
    for (let entry of reviewStates) {
      assert.ok(Array.isArray(entry), "Each state entry should be an array");
      assert.equal(entry.length, 2, "Each entry should have [id, state]");
      assert.ok(
        typeof entry[0] === "number",
        "First element should be service ID"
      );
      assert.ok(
        typeof entry[1] === "object",
        "Second element should be state object"
      );
      assert.ok(entry[1].hasOwnProperty("type"), "State should have type");
      assert.ok(entry[1].hasOwnProperty("data"), "State should have data");
    }

    // Verify specific service types
    const phabState = reviewStates.find((entry) => entry[1].type === "phabricator");
    const githubState = reviewStates.find((entry) => entry[1].type === "github");

    assert.ok(phabState, "Should have Phabricator state");
    assert.ok(githubState, "Should have GitHub state");
    assert.equal(phabState[0], 1, "Phabricator should have ID 1");
    assert.equal(githubState[0], 2, "GitHub should have ID 2");
  });

  it("should return a Promise from get-feature-rev message handler", async () => {
    browser.storage.local.get.withArgs("services").returns(Promise.resolve({}));

    await MyQOnly.init();

    const result = MyQOnly.onMessage({ name: "get-feature-rev" }, {});

    assert.ok(result instanceof Promise, "get-feature-rev should return a Promise");
  });

  it("should resolve get-feature-rev with newFeatures and featureRev", async () => {
    browser.storage.local.get.withArgs("services").returns(Promise.resolve({}));

    await MyQOnly.init();

    const result = await MyQOnly.onMessage({ name: "get-feature-rev" }, {});

    assert.ok(result.hasOwnProperty("newFeatures"), "should have newFeatures");
    assert.ok(result.hasOwnProperty("featureRev"), "should have featureRev");
    assert.equal(typeof result.newFeatures, "boolean");
    assert.equal(typeof result.featureRev, "number");
  });

  it("should return a promise from refresh message handler", async () => {
    browser.storage.local.get.withArgs("services").returns(Promise.resolve({}));

    await MyQOnly.init();

    const refreshPromise = MyQOnly.onMessage({ name: "refresh" }, {}, () => {});

    assert.ok(
      refreshPromise instanceof Promise,
      "refresh should return a promise"
    );
    await refreshPromise; // Should not throw
  });

  it("should persist updated states after each updateBadge call", async () => {
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

    await MyQOnly.init();

    // Clear previous calls
    browser.storage.local.set.resetHistory();

    // Call updateBadge again
    await MyQOnly.updateBadge();

    // Verify storage was updated again
    const setCall = browser.storage.local.set
      .getCalls()
      .find((call) => call.args[0].hasOwnProperty("reviewStates"));

    assert.ok(setCall, "reviewStates should be saved after second update");
  });
});
