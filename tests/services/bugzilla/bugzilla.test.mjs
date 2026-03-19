import { BugzillaService } from "../../../addon/services/bugzilla-service.mjs";
import {
  BUGZILLA_API,
  BUGZILLA_DASHBOARD,
  BUGZILLA_METHOD,
  BUGZILLA_REQUEST_ID,
  BUGZILLA_VERSION,
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
        assert.ok(error.message.includes("Invalid API key"));
      }
    });

    it("should use correct JSON-RPC request format", async function () {
      let capturedBody;

      sandbox.stub(window, "fetch").callsFake(async (request) => {
        capturedBody = await request.text();

        return {
          ok: true,
          json: async () => fixtures.bugzilla.apiEmptyResponse
        };
      });

      let settings = { apiKey: "test-key", needinfos: false };
      await bugzillaService.update(settings);

      let body = JSON.parse(capturedBody);
      assert.equal(body.method, BUGZILLA_METHOD);
      assert.equal(body.params.Bugzilla_api_key, "test-key");
      assert.equal(body.params.type, "requestee");
      assert.equal(body.version, BUGZILLA_VERSION);
      assert.equal(body.id, BUGZILLA_REQUEST_ID);
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
