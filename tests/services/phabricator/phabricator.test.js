describe('Phabricator', function() {
  const TEST_URL_PREFIX = "base/tests/services/phabricator";

  it('should be able to load the simple case', async function() {
    let testingURL = [TEST_URL_PREFIX, "one-ready.html"].join("/");
    let total = await MyQOnly.phabricatorReviewRequests({ testingURL });
    assert.equal(total, 1);
  });
});
