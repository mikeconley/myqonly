describe("MyQOnly initting fresh", function() {
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
    // Keeping userKeys around for the migration step.
    browser.storage.local.get.withArgs("userKeys").returns(
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
    MyQOnly.uninit();
    browser.flush();
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

  it("should migrate old userKeys to the new services schema", async () => {
    browser.storage.local.get.withArgs("userKeys").returns(
      Promise.resolve({
        userKeys: {
          bugzilla: "abc123",
          ghuser: "mikeconley",
        },
      })
    );

    await MyQOnly.init();

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
      },],
      userKeys: null,
      oldUserKeys: {
        bugzilla: "abc123",
        ghuser: "mikeconley",
      },
    }));
  });

  it("should migrate bugzilla userKeys to the new schema", async () => {
    browser.storage.local.get.withArgs("userKeys").returns(
      Promise.resolve({
        userKeys: {
          bugzilla: "abc123",
        },
      })
    );

    await MyQOnly.init();

    assert.ok(browser.storage.local.set.calledWith({
      services: [{
        id: 1,
        type: "bugzilla",
        settings: {
          apiKey: "abc123",
        },
      },],
      userKeys: null,
      oldUserKeys: {
        bugzilla: "abc123",
      },
    }));
  });

  it("should migrate GitHub userKeys to the new schema", async () => {
    browser.storage.local.get.withArgs("userKeys").returns(
      Promise.resolve({
        userKeys: {
          ghuser: "mikeconley",
        },
      })
    );

    await MyQOnly.init();

    assert.ok(browser.storage.local.set.calledWith({
      services: [{
        id: 1,
        type: "github",
        settings: {
          username: "mikeconley",
        },
      },],
      userKeys: null,
      oldUserKeys: {
        ghuser: "mikeconley",
      },
    }));
  });
});
