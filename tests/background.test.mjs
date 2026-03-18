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
    // Should have set up listeners and alarms
    assert.ok(browser.storage.onChanged.addListener.calledOnce);
    assert.ok(browser.alarms.onAlarm.addListener.calledOnce);
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
