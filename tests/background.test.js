describe("MyQOnly initting fresh", function() {
  let mqo = new MyQOnly();

  beforeEach(async function() {
    browser.storage.local.get.withArgs("featureRev").returns(
      Promise.resolve({})
    );
    browser.storage.local.set.returns(
      Promise.resolve({})
    );
    browser.storage.local.get.withArgs("updateInterval").returns(
      Promise.resolve({})
    );
    browser.storage.local.get.withArgs("services").returns(
      Promise.resolve({})
    );
    browser.storage.local.get.withArgs("workingHours").returns(
      Promise.resolve({})
    );
  });

  afterEach(async function() {
    mqo.uninit();
    browser.flush();
  });

  it("should exist, and be able to init with defaults", async () => {
    should.exist(mqo);
    await mqo.init();
    // Should have set up listeners and alarms
    assert.ok(browser.storage.onChanged.addListener.calledOnce);
    assert.ok(browser.alarms.onAlarm.addListener.calledOnce);
    assert.ok(browser.runtime.onMessage.addListener.calledOnce);

    assert.equal(mqo.featureRev, FEATURE_ALERT_REV);
    assert.equal(mqo.updateInterval, DEFAULT_UPDATE_INTERVAL);

    // We should default with the Phabricator service enabled
    assert.equal(mqo.services.length, 1);
    assert.equal(mqo.services[0].type, "phabricator");

    for (let service in mqo.reviewTotals) {
      assert.equal(mqo.reviewTotals[service], 0);
    }

    assert.ok(browser.storage.local.set.calledWith({
      featureRev: FEATURE_ALERT_REV,
    }));
    assert.ok(browser.storage.local.set.calledWith({
      updateInterval: DEFAULT_UPDATE_INTERVAL,
    }));
    assert.ok(browser.alarms.create.calledWith(ALARM_NAME, {
      periodInMinutes: DEFAULT_UPDATE_INTERVAL,
    }));
  });

  it("should give unique IDs when adding the Phabricator service", async () => {
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
        },],
      })
    );

    await mqo.init();

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
  });

  it("should add the default Phabricator service for " +
     "new installs", async () => {
    browser.storage.local.get.withArgs("services").returns(
      Promise.resolve({})
    );

    await mqo.init();

    assert.ok(browser.storage.local.set.calledWith({
      services: [{
        id: 1,
        type: "phabricator",
        settings: {
          container: 0,
          inclReviewerGroups: true,
        },
      },],
    }));
  });

  it("should default the Phabricator service to show the " +
     "review group count.", async () => {
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
          },
        },],
      })
    );

    await mqo.init();

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
  });

  it("should not update review group configuration for Phabricator " +
     "if it was already set.", async () => {
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
            inclReviewerGroups: false,
          },
        },],
      })
    );

    await mqo.init();

    let service = mqo._getService("phabricator");
    assert(!service.settings.inclReviewerGroups);
  });
});
