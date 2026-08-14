import { PhabricatorService } from "../../../addon/services/phabricator-service.mjs";
import { PHABRICATOR_METHODS } from "../../../addon/constants.mjs";
import { fixtures } from "../../test-utils.mjs";

const {
  USER_PHID,
  GROUP_PHID,
  OTHER_USER_PHID,
  OTHER_GROUP_PHID,
  whoamiResponse,
  projectSearchResponse,
  revision,
  searchResponse
} = fixtures.phabricator.conduit;

const MINE = [USER_PHID, GROUP_PHID];

/**
 * Stubs fetch so each Conduit method answers from a queue of responses,
 * letting a test walk a paginated search. Returns the recorded calls.
 */
function stubConduit(sandbox, responsesByMethod) {
  let calls = [];

  sandbox.stub(window, "fetch").callsFake(async (request) => {
    let url = request.url || String(request);
    let method = url.split("/api/")[1];
    calls.push({ method, request });

    let queued = responsesByMethod[method];
    if (queued === undefined) {
      return { ok: false, status: 404, text: async () => "Not found" };
    }

    let response = Array.isArray(queued) ? queued.shift() : queued;
    if (response.httpStatus) {
      return {
        ok: false,
        status: response.httpStatus,
        text: async () => ""
      };
    }

    return { ok: true, status: 200, json: async () => response };
  });

  return calls;
}

function conduitStubs(revisions, overrides = {}) {
  return {
    [PHABRICATOR_METHODS.WHOAMI]: whoamiResponse,
    [PHABRICATOR_METHODS.PROJECT_SEARCH]: projectSearchResponse,
    [PHABRICATOR_METHODS.REVISION_SEARCH]: searchResponse(revisions),
    ...overrides
  };
}

describe("Phabricator", function () {
  const TEST_URL_PREFIX = "/tests/services/phabricator";
  let phabService;
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    phabService = new PhabricatorService();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe("scraping path", function () {
    it("should be able to load the simple case", async function () {
      let testingURL = [TEST_URL_PREFIX, "one-ready.html"].join("/");
      let { ok, reviewTotal } = await phabService._fetchReviewRequests({
        testingURL
      });
      assert.ok(ok);
      assert.equal(reviewTotal, 1);
    });

    it("should be able to load the empty case", async function () {
      let testingURL = [TEST_URL_PREFIX, "empty.html"].join("/");
      let { ok, reviewTotal } = await phabService._fetchReviewRequests({
        testingURL
      });
      assert.ok(ok);
      assert.equal(reviewTotal, 0);
    });
  });

  describe("path selection", function () {
    it("should use Conduit when an API token is set", async function () {
      let calls = stubConduit(sandbox, conduitStubs([]));

      await phabService.update({ apiToken: "api-token", container: 0 });

      assert.ok(calls.length, "Should have made Conduit calls");
      assert.ok(
        calls.some((c) => c.method == PHABRICATOR_METHODS.REVISION_SEARCH)
      );
    });

    it("should use scraping when no API token is set", async function () {
      let cookieStub = sandbox.stub().resolves(null);
      let hadBrowser = "browser" in window;
      let previousBrowser = window.browser;
      window.browser = { cookies: { get: cookieStub } };

      try {
        let result = await phabService.update({ container: 0 });

        assert.ok(
          cookieStub.called,
          "Should have checked for a session cookie"
        );
        assert.equal(result.connected, false);
      } finally {
        if (hadBrowser) {
          window.browser = previousBrowser;
        } else {
          delete window.browser;
        }
      }
    });

    it("should report disabled when neither path is configured", async function () {
      let result = await phabService.update({});
      assert.ok(result.disabled);
      assert.equal(result.reviewTotal, 0);
    });
  });

  describe("isConfigured()", function () {
    it("should be configured with only a token", function () {
      assert.ok(phabService.isConfigured({ apiToken: "api-token" }));
    });

    it("should be configured with only a container", function () {
      assert.ok(phabService.isConfigured({ container: 0 }));
    });

    it("should not be configured with neither", function () {
      assert.ok(!phabService.isConfigured({}));
    });
  });

  describe("_bucketRevisions()", function () {
    function bucket(revisions) {
      return phabService._bucketRevisions(revisions, MINE, USER_PHID);
    }

    for (let status of ["blocking", "rejected", "rejected-older"]) {
      it(`should count '${status}' as a review to do`, function () {
        let result = bucket([
          revision(1, {
            status: "needs-review",
            reviewers: [[USER_PHID, status]]
          })
        ]);
        assert.equal(result.userReviewTotal, 1);
        assert.equal(result.groupReviewTotal, 0);
      });
    }

    for (let status of ["added", "commented"]) {
      it(`should count '${status}' as a review to do`, function () {
        let result = bucket([
          revision(1, {
            status: "needs-review",
            reviewers: [[USER_PHID, status]]
          })
        ]);
        assert.equal(result.userReviewTotal, 1);
      });
    }

    it("should not count 'accepted' when another reviewer is blocking", function () {
      let result = bucket([
        revision(1, {
          status: "needs-review",
          reviewers: [
            [USER_PHID, "accepted"],
            [OTHER_USER_PHID, "blocking"]
          ]
        })
      ]);
      assert.equal(result.reviewTotal, 0);
      assert.equal(result.groupReviewTotal, 0);
    });

    it("should not count 'accepted-older'", function () {
      let result = bucket([
        revision(1, {
          status: "needs-review",
          reviewers: [[USER_PHID, "accepted-older"]]
        })
      ]);
      assert.equal(result.reviewTotal, 0);
    });

    it("should drop revisions resigned from, even via a group", function () {
      let result = bucket([
        revision(1, {
          status: "needs-review",
          reviewers: [
            [USER_PHID, "resigned"],
            [GROUP_PHID, "blocking"]
          ]
        })
      ]);
      assert.equal(result.reviewTotal, 0);
      assert.equal(result.groupReviewTotal, 0);
    });

    it("should drop other people's drafts", function () {
      let result = bucket([
        revision(1, {
          status: "draft",
          reviewers: [[USER_PHID, "blocking"]]
        })
      ]);
      assert.equal(result.reviewTotal, 0);
    });

    it("should drop revisions authored by the user", function () {
      let result = bucket([
        revision(1, {
          author: USER_PHID,
          status: "needs-review",
          reviewers: [[OTHER_USER_PHID, "blocking"]]
        })
      ]);
      assert.equal(result.reviewTotal, 0);
    });

    for (let status of ["needs-revision", "changes-planned", "accepted"]) {
      it(`should drop revisions in the '${status}' state`, function () {
        let result = bucket([
          revision(1, { status, reviewers: [[USER_PHID, "blocking"]] })
        ]);
        assert.equal(result.reviewTotal, 0);
      });
    }

    it("should count a group-only match as a group review", function () {
      let result = bucket([
        revision(1, {
          status: "needs-review",
          reviewers: [[GROUP_PHID, "blocking"]]
        })
      ]);
      assert.equal(result.userReviewTotal, 0);
      assert.equal(result.groupReviewTotal, 1);
    });

    it("should not count groups the user does not belong to", function () {
      let result = bucket([
        revision(1, {
          status: "needs-review",
          reviewers: [[OTHER_GROUP_PHID, "blocking"]]
        })
      ]);
      assert.equal(result.reviewTotal, 0);
      assert.equal(result.groupReviewTotal, 0);
    });

    it("should count a user and group match once, as a user review", function () {
      let result = bucket([
        revision(1, {
          status: "needs-review",
          reviewers: [
            [USER_PHID, "blocking"],
            [GROUP_PHID, "blocking"]
          ]
        })
      ]);
      assert.equal(result.userReviewTotal, 1);
      assert.equal(result.groupReviewTotal, 0);
    });

    it("should report reviewTotal as the user's own reviews only", function () {
      let result = bucket([
        revision(1, {
          status: "needs-review",
          reviewers: [[USER_PHID, "blocking"]]
        }),
        revision(2, {
          status: "needs-review",
          reviewers: [[GROUP_PHID, "blocking"]]
        })
      ]);
      assert.equal(result.userReviewTotal, 1);
      assert.equal(result.groupReviewTotal, 1);
      assert.equal(result.reviewTotal, 1);
    });

    it("should tolerate a missing reviewers attachment", function () {
      let result = bucket([
        {
          id: 1,
          fields: {
            authorPHID: OTHER_USER_PHID,
            status: { value: "needs-review" }
          }
        }
      ]);
      assert.equal(result.reviewTotal, 0);
    });

    // Mirrors the mix seen on a real account during the Phase 0 probe.
    it("should handle a realistic mixed queue", function () {
      let result = bucket([
        revision(101, {
          status: "needs-review",
          reviewers: [[USER_PHID, "blocking"]]
        }),
        revision(102, {
          status: "needs-review",
          reviewers: [[USER_PHID, "rejected"]]
        }),
        revision(103, {
          status: "needs-review",
          reviewers: [
            [GROUP_PHID, "blocking"],
            [OTHER_USER_PHID, "accepted"]
          ]
        }),
        revision(104, {
          status: "needs-review",
          reviewers: [[GROUP_PHID, "added"]]
        }),
        revision(105, {
          status: "needs-review",
          reviewers: [
            [GROUP_PHID, "accepted"],
            [OTHER_USER_PHID, "blocking"]
          ]
        }),
        revision(106, { author: USER_PHID, status: "needs-review" }),
        revision(107, {
          status: "changes-planned",
          reviewers: [[USER_PHID, "blocking"]]
        })
      ]);

      assert.equal(result.userReviewTotal, 2, "101 and 102");
      assert.equal(result.groupReviewTotal, 2, "103 and 104");
      assert.equal(result.reviewTotal, 2);
    });
  });

  describe("Conduit transport", function () {
    it("should count reviews end to end", async function () {
      stubConduit(
        sandbox,
        conduitStubs([
          revision(1, {
            status: "needs-review",
            reviewers: [[USER_PHID, "blocking"]]
          }),
          revision(2, {
            status: "needs-review",
            reviewers: [[GROUP_PHID, "added"]]
          })
        ])
      );

      let result = await phabService.update({ apiToken: "api-token" });

      assert.ok(result.connected);
      assert.equal(result.userReviewTotal, 1);
      assert.equal(result.groupReviewTotal, 1);
    });

    it("should send the token and the active query key", async function () {
      let calls = stubConduit(sandbox, conduitStubs([]));

      await phabService.update({ apiToken: "api-token" });

      let search = calls.find(
        (c) => c.method == PHABRICATOR_METHODS.REVISION_SEARCH
      );
      let body = await search.request.text();
      assert.include(body, "api.token=api-token");
      assert.include(body, "queryKey=active");
      assert.include(body, "attachments%5Breviewers%5D=true");
    });

    it("should never send the WAF-blocked open() token", async function () {
      let calls = stubConduit(sandbox, conduitStubs([]));

      await phabService.update({ apiToken: "api-token" });

      for (let call of calls) {
        let body = await call.request.text();
        assert.notInclude(decodeURIComponent(body), "open()");
      }
    });

    it("should follow result cursors", async function () {
      let stubs = conduitStubs([]);
      stubs[PHABRICATOR_METHODS.REVISION_SEARCH] = [
        searchResponse(
          [
            revision(1, {
              status: "needs-review",
              reviewers: [[USER_PHID, "blocking"]]
            })
          ],
          "cursor-1"
        ),
        searchResponse([
          revision(2, {
            status: "needs-review",
            reviewers: [[USER_PHID, "blocking"]]
          })
        ])
      ];
      let calls = stubConduit(sandbox, stubs);

      let result = await phabService.update({ apiToken: "api-token" });

      assert.equal(result.userReviewTotal, 2, "Should count both pages");
      let searches = calls.filter(
        (c) => c.method == PHABRICATOR_METHODS.REVISION_SEARCH
      );
      assert.equal(searches.length, 2);
      assert.include(await searches[1].request.text(), "after=cursor-1");
    });

    it("should report disconnected when the token is rejected", async function () {
      let stubs = conduitStubs([]);
      stubs[PHABRICATOR_METHODS.WHOAMI] = {
        result: null,
        error_code: "ERR-INVALID-AUTH",
        error_info: "API token is invalid."
      };
      stubConduit(sandbox, stubs);

      let result = await phabService.update({ apiToken: "api-bad" });

      assert.equal(result.connected, false);
      assert.equal(result.reviewTotal, 0);
    });

    it("should throw on a WAF rejection rather than report zero", async function () {
      let stubs = conduitStubs([]);
      stubs[PHABRICATOR_METHODS.REVISION_SEARCH] = { httpStatus: 406 };
      stubConduit(sandbox, stubs);

      try {
        await phabService.update({ apiToken: "api-token" });
        assert.fail("Should have thrown");
      } catch (e) {
        assert.include(e.message, "406");
      }
    });

    it("should throw on a non-auth Conduit error", async function () {
      let stubs = conduitStubs([]);
      stubs[PHABRICATOR_METHODS.REVISION_SEARCH] = {
        result: null,
        error_code: "ERR-CONDUIT-CORE",
        error_info: "Something broke."
      };
      stubConduit(sandbox, stubs);

      try {
        await phabService.update({ apiToken: "api-token" });
        assert.fail("Should have thrown");
      } catch (e) {
        assert.include(e.message, "ERR-CONDUIT-CORE");
      }
    });

    it("should cache identity and groups across polls", async function () {
      let calls = stubConduit(sandbox, {
        [PHABRICATOR_METHODS.WHOAMI]: whoamiResponse,
        [PHABRICATOR_METHODS.PROJECT_SEARCH]: projectSearchResponse,
        [PHABRICATOR_METHODS.REVISION_SEARCH]: searchResponse([])
      });

      await phabService.update({ apiToken: "api-token" });
      await phabService.update({ apiToken: "api-token" });

      let whoamiCalls = calls.filter(
        (c) => c.method == PHABRICATOR_METHODS.WHOAMI
      );
      assert.equal(whoamiCalls.length, 1, "Should only resolve identity once");
    });

    it("should re-resolve identity when the token changes", async function () {
      let calls = stubConduit(sandbox, {
        [PHABRICATOR_METHODS.WHOAMI]: whoamiResponse,
        [PHABRICATOR_METHODS.PROJECT_SEARCH]: projectSearchResponse,
        [PHABRICATOR_METHODS.REVISION_SEARCH]: searchResponse([])
      });

      await phabService.update({ apiToken: "api-one" });
      await phabService.update({ apiToken: "api-two" });

      let whoamiCalls = calls.filter(
        (c) => c.method == PHABRICATOR_METHODS.WHOAMI
      );
      assert.equal(whoamiCalls.length, 2);
    });
  });

  describe("validateToken()", function () {
    it("should resolve the account for a good token", async function () {
      stubConduit(sandbox, conduitStubs([]));

      let result = await phabService.validateToken({ apiToken: "api-token" });

      assert.ok(result.valid);
      assert.equal(result.userName, "testuser");
    });

    it("should report invalid for a rejected token", async function () {
      stubConduit(sandbox, {
        [PHABRICATOR_METHODS.WHOAMI]: {
          result: null,
          error_code: "ERR-INVALID-AUTH",
          error_info: "API token is invalid."
        }
      });

      let result = await phabService.validateToken({ apiToken: "api-bad" });

      assert.ok(!result.valid);
      assert.include(result.error, "ERR-INVALID-AUTH");
    });

    it("should report invalid when no token is set", async function () {
      let result = await phabService.validateToken({});
      assert.ok(!result.valid);
    });
  });
});
