import { BugzillaService } from "../../../addon/services/bugzilla-service.mjs";
import {
  BUGZILLA_API,
  BUGZILLA_DASHBOARD,
  HTTP_METHODS,
  SERVICE_TYPES
} from "../../../addon/constants.mjs";
import {
  fixtures,
  createMockService,
  createFetchMock,
  describeBaseServiceTests
} from "../../test-utils.mjs";

describe("Bugzilla Service", function () {
  let bugzillaService;
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    bugzillaService = new BugzillaService();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe("update()", function () {
    it("should return zero counts when API key is missing", async function () {
      let settings = { apiKey: "" };
      let result = await bugzillaService.update(settings);

      assert.equal(result.reviewTotal, 0);
      assert.equal(result.needinfoTotal, 0);
    });

    it("should fetch and count review requests", async function () {
      let fetchMock = createFetchMock(sandbox);
      fetchMock.respondWithJson(
        BUGZILLA_API,
        fixtures.bugzilla.apiSuccessResponse
      );

      let settings = { apiKey: "test-key", needinfos: false };
      let result = await bugzillaService.update(settings);

      assert.equal(result.reviewTotal, 2);
      assert.equal(result.needinfoTotal, 0);
    });

    it("should fetch and count review + needinfo requests when enabled", async function () {
      let fetchMock = createFetchMock(sandbox);
      fetchMock.respondWithJson(
        BUGZILLA_API,
        fixtures.bugzilla.apiSuccessResponse
      );

      let settings = { apiKey: "test-key", needinfos: true };
      let result = await bugzillaService.update(settings);

      assert.equal(result.reviewTotal, 2);
      assert.equal(result.needinfoTotal, 1);
    });

    it("should return zero counts when no requests exist", async function () {
      let fetchMock = createFetchMock(sandbox);
      fetchMock.respondWithJson(
        BUGZILLA_API,
        fixtures.bugzilla.apiEmptyResponse
      );

      let settings = { apiKey: "test-key", needinfos: true };
      let result = await bugzillaService.update(settings);

      assert.equal(result.reviewTotal, 0);
      assert.equal(result.needinfoTotal, 0);
    });

    it("should throw error when API returns error", async function () {
      let fetchMock = createFetchMock(sandbox);
      fetchMock.respondWithJson(
        BUGZILLA_API,
        fixtures.bugzilla.apiErrorResponse
      );

      let settings = { apiKey: "invalid-key", needinfos: false };

      try {
        await bugzillaService.update(settings);
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.ok(
          error.message.includes("The API key you specified is invalid")
        );
      }
    });

    it("should use correct REST request format", async function () {
      let capturedRequest;

      sandbox.stub(window, "fetch").callsFake(async (request) => {
        capturedRequest = request;

        return {
          ok: true,
          status: 200,
          json: async () => fixtures.bugzilla.apiEmptyResponse
        };
      });

      let settings = { apiKey: "test-key", needinfos: false };
      await bugzillaService.update(settings);

      let url = new URL(capturedRequest.url);
      assert.equal(capturedRequest.method, HTTP_METHODS.GET);
      assert.equal(`${url.origin}${url.pathname}`, BUGZILLA_API);
      assert.equal(url.searchParams.get("type"), "requestee");
      assert.equal(
        capturedRequest.headers.get("X-BUGZILLA-API-KEY"),
        "test-key"
      );
      assert.equal(url.searchParams.get("Bugzilla_api_key"), null);
    });

    it("should throw when the endpoint returns a non-2xx response", async function () {
      sandbox.stub(window, "fetch").resolves({
        ok: false,
        status: 404,
        text: async () => "<!DOCTYPE html><title>Page Not Found</title>"
      });

      let settings = { apiKey: "test-key", needinfos: true };

      try {
        await bugzillaService.update(settings);
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.ok(error.message.includes("404"));
        assert.ok(error.message.includes("Page Not Found"));
      }
    });
  });

  describeBaseServiceTests(
    () => bugzillaService,
    {
      serviceType: SERVICE_TYPES.BUGZILLA,
      dashboardUrl: BUGZILLA_DASHBOARD,
      configKey: "apiKey",
      configTestValue: "test-key"
    }
  );
});
