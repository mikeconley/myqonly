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
    browser.storage.local.get.withArgs("userKeys").returns(
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

  it("should exist, and be able to init with defaults", async function() {
    should.exist(MyQOnly);
    await MyQOnly.init();
    // Should have set up listeners and alarms
    assert.ok(browser.storage.onChanged.addListener.calledOnce);
    assert.ok(browser.alarms.onAlarm.addListener.calledOnce);
    assert.ok(browser.runtime.onMessage.addListener.calledOnce);

    assert.equal(MyQOnly.featureRev, FEATURE_ALERT_REV);
    assert.equal(MyQOnly.updateInterval, DEFAULT_UPDATE_INTERVAL);
    assert.isEmpty(MyQOnly.userKeys);

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
});
