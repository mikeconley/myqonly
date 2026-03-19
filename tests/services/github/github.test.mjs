import { GitHubService } from "../../../addon/services/github-service.mjs";
import {
  GITHUB_API,
  GITHUB_REVIEW_URL,
  SERVICE_TYPES
} from "../../../addon/constants.mjs";
import {
  fixtures,
  createMockService,
  createFetchMock,
  describeBaseServiceTests
} from "../../test-utils.mjs";

describe("GitHub Service", function () {
  let githubService;
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    githubService = new GitHubService();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe("hasOldFormatRepos()", function () {
    it("should return true for repos without slashes", function () {
      assert.ok(GitHubService.hasOldFormatRepos("mozilla"));
    });

    it("should return true for multiple repos with at least one old format", function () {
      assert.ok(GitHubService.hasOldFormatRepos("mozilla/gecko-dev, taskcluster"));
    });

    it("should return false for repos in owner/repo format", function () {
      assert.ok(!GitHubService.hasOldFormatRepos("mozilla/gecko-dev"));
    });

    it("should return false for multiple repos all in new format", function () {
      assert.ok(!GitHubService.hasOldFormatRepos("mozilla/gecko-dev, rust-lang/rust"));
    });

    it("should return false for empty string", function () {
      assert.ok(!GitHubService.hasOldFormatRepos(""));
    });

    it("should return false for undefined", function () {
      assert.ok(!GitHubService.hasOldFormatRepos(undefined));
    });

    it("should handle whitespace correctly", function () {
      assert.ok(GitHubService.hasOldFormatRepos("  mozilla  ,  taskcluster  "));
    });

    it("should ignore empty entries after splitting", function () {
      assert.ok(!GitHubService.hasOldFormatRepos("mozilla/gecko-dev, , rust-lang/rust"));
    });
  });

  describe("update()", function () {
    it("should return zero count when username is missing", async function () {
      let settings = { username: "" };
      let result = await githubService.update(settings);

      assert.equal(result.reviewTotal, 0);
      assert.ok(result.reviewUrl.includes(GITHUB_REVIEW_URL));
    });

    it("should fetch and count pull requests", async function () {
      let fetchMock = createFetchMock(sandbox);
      fetchMock.respondWithJson(
        GITHUB_API,
        fixtures.github.searchSuccessResponse
      );

      let settings = { username: "testuser" };
      let result = await githubService.update(settings);

      assert.equal(result.reviewTotal, 2);
      assert.ok(result.reviewUrl);
    });

    it("should return zero count when no PRs exist", async function () {
      let fetchMock = createFetchMock(sandbox);
      fetchMock.respondWithJson(
        GITHUB_API,
        fixtures.github.searchEmptyResponse
      );

      let settings = { username: "testuser" };
      let result = await githubService.update(settings);

      assert.equal(result.reviewTotal, 0);
    });

    it("should exclude own PRs when ignoreOwnPrs is true", async function () {
      sandbox.stub(window, "fetch").callsFake(async (url) => {
        let query = url.searchParams.get("q");
        assert.ok(query.includes("-author:testuser"));

        return {
          ok: true,
          json: async () => fixtures.github.searchEmptyResponse
        };
      });

      let settings = { username: "testuser", ignoreOwnPrs: true };
      await githubService.update(settings);
    });

    it("should exclude draft PRs when ignoreDraftPrs is true", async function () {
      sandbox.stub(window, "fetch").callsFake(async (url) => {
        let query = url.searchParams.get("q");
        assert.ok(query.includes("draft:false"));

        return {
          ok: true,
          json: async () => fixtures.github.searchEmptyResponse
        };
      });

      let settings = { username: "testuser", ignoreDraftPrs: true };
      await githubService.update(settings);
    });

    it("should exclude ignored repositories", async function () {
      sandbox.stub(window, "fetch").callsFake(async (url) => {
        let query = url.searchParams.get("q");
        assert.ok(query.includes("-repo:owner/repo1"));
        assert.ok(query.includes("-repo:owner/repo2"));

        return {
          ok: true,
          json: async () => fixtures.github.searchEmptyResponse
        };
      });

      let settings = {
        username: "testuser",
        ignoredRepos: "owner/repo1, owner/repo2"
      };
      await githubService.update(settings);
    });

    it("should exclude ignored users", async function () {
      sandbox.stub(window, "fetch").callsFake(async (url) => {
        let query = url.searchParams.get("q");
        assert.ok(query.includes("-author:user1"));
        assert.ok(query.includes("-author:user2"));

        return {
          ok: true,
          json: async () => fixtures.github.searchEmptyResponse
        };
      });

      let settings = {
        username: "testuser",
        ignoredUsers: "user1, user2"
      };
      await githubService.update(settings);
    });

    it("should deduplicate ignored users", async function () {
      sandbox.stub(window, "fetch").callsFake(async (url) => {
        let query = url.searchParams.get("q");
        let matches = query.match(/-author:user1/g);
        assert.equal(matches.length, 1);

        return {
          ok: true,
          json: async () => fixtures.github.searchEmptyResponse
        };
      });

      let settings = {
        username: "testuser",
        ignoredUsers: "user1, user1, user1"
      };
      await githubService.update(settings);
    });

    it("should exclude ignored teams", async function () {
      sandbox.stub(window, "fetch").callsFake(async (url) => {
        let query = url.searchParams.get("q");
        assert.ok(query.includes("-team-review-requested:team1"));
        assert.ok(query.includes("-team-review-requested:team2"));

        return {
          ok: true,
          json: async () => fixtures.github.searchEmptyResponse
        };
      });

      let settings = {
        username: "testuser",
        ignoredTeams: "team1, team2"
      };
      await githubService.update(settings);
    });

    it("should include authorization header when token is provided", async function () {
      sandbox.stub(window, "fetch").callsFake(async (url, options) => {
        assert.equal(options.headers.Authorization, "token test-token-123");

        return {
          ok: true,
          json: async () => fixtures.github.searchEmptyResponse
        };
      });

      let settings = { username: "testuser", token: "test-token-123" };
      await githubService.update(settings);
    });

    it("should throw error when API request fails", async function () {
      let fetchMock = createFetchMock(sandbox);
      fetchMock.respondWithError(403, "Rate limit exceeded");

      let settings = { username: "testuser" };

      try {
        await githubService.update(settings);
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.ok(error.message.includes("Github request failed"));
        assert.ok(error.message.includes("403"));
      }
    });

    it("should build correct search query with all filters", async function () {
      sandbox.stub(window, "fetch").callsFake(async (url) => {
        let query = url.searchParams.get("q");

        assert.ok(query.includes("review-requested:testuser"));
        assert.ok(query.includes("type:pr"));
        assert.ok(query.includes("is:open"));
        assert.ok(query.includes("archived:false"));
        assert.ok(query.includes("-author:testuser"));
        assert.ok(query.includes("-author:user1"));
        assert.ok(query.includes("-team-review-requested:team1"));
        assert.ok(query.includes("draft:false"));
        assert.ok(query.includes("-repo:owner/repo1"));

        return {
          ok: true,
          json: async () => fixtures.github.searchEmptyResponse
        };
      });

      let settings = {
        username: "testuser",
        token: "test-token",
        ignoredRepos: "owner/repo1",
        ignoredUsers: "user1",
        ignoredTeams: "team1",
        ignoreOwnPrs: true,
        ignoreDraftPrs: true
      };
      await githubService.update(settings);
    });
  });

  describeBaseServiceTests(
    () => githubService,
    {
      serviceType: SERVICE_TYPES.GITHUB,
      dashboardUrl: GITHUB_REVIEW_URL,
      configKey: "username",
      configTestValue: "testuser"
    }
  );
});
