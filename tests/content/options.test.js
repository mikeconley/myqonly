describe('Options page', function() {
  it('should show stored interval time, and be able to update', async function() {
    await loadPage({
      url: '/addon/content/options/options.html',
      setup: async(browser) => {
        browser.storage.local.get.withArgs('updateInterval').returns(
          Promise.resolve({ updateInterval: DEFAULT_UPDATE_INTERVAL })
        );
        browser.storage.local.get.withArgs('userKeys').returns(
          Promise.resolve({})
        );
        browser.storage.local.get.withArgs({ workingHours: {} }).returns(
          Promise.resolve({})
        );
      },
      test: async(content, document) => {
        let field = document.getElementById("update-interval");
        parseInt(field.value, 10).should.equal(DEFAULT_UPDATE_INTERVAL);

        // Now update the value
        let newInterval = DEFAULT_UPDATE_INTERVAL + 1
        browser.storage.local.set.withArgs({ updateInterval: undefined }).returns(
          Promise.resolve()
        );
        changeFieldValue(field, newInterval);
        assert.ok(browser.storage.local.set.calledOnce);
        assert.ok(browser.storage.local.set.calledWith({ updateInterval: newInterval }));
      },
    });
  });
});
