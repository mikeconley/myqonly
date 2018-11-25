describe("Phabricator", function() {
  const TEST_URL_PREFIX = "base/tests/services/phabricator";

  it("should be able to load the simple case", async function() {
    let testingURL = [TEST_URL_PREFIX, "one-ready.html",].join("/");
    let { ok, reviewTotal, } =
      await MyQOnly.phabricatorReviewRequests({ testingURL, });
    assert.ok(ok);
    assert.equal(reviewTotal, 1);
  });

  it("should be able to load the empty case", async function() {
    let testingURL = [TEST_URL_PREFIX, "empty.html",].join("/");
    let { ok, reviewTotal, } =
      await MyQOnly.phabricatorReviewRequests({ testingURL, });
    assert.ok(ok);
    assert.equal(reviewTotal, 0);
  });
});
