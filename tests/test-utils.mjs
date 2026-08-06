/**
 * Runs some optional setup script to prepare sinon-chrome with
 * some values, and then loads a url in an iframe in the main document
 * body, waits for it to load, and runs a test function. The test
 * function is passed the content window of the iframe.
 *
 * @params options (object)
 *
 *         url (string):
 *           The URL of the page to load.
 *
 *         setup (async function(browser), optional):
 *           A function that accepts a single argument, which is a
 *           sinon-chrome WebExtension API mockery that can be prepared
 *           with values.
 *
 *         waitForInitted (bool, optional):
 *           Defaults to true. Waits for a page to fire an "initted" event
 *           on the document before running the test.
 *
 *         test (async function(content)):
 *           The test function that accepts two arguments: the content
 *           window for the loaded iframe, and the content document. When
 *           this function is called, the load event has already fired in
 *           the document. If waitForInitted is true, the document has also
 *           fired a custom "initted" event.
 *
 */
async function loadPage({ url, setup, waitForInitted = true, test } = {}) {
  let iframe = document.createElement("iframe");
  iframe.src = url;
  document.body.appendChild(iframe);
  let browser = chrome;

  // Reset sinon-chrome
  browser.flush();
  if (setup) {
    await setup(browser);
  }

  iframe.contentWindow.browser = chrome;
  iframe.contentWindow.console = console;

  await new Promise((resolve) => {
    let event = waitForInitted ? "initted" : "load";
    iframe.contentWindow.addEventListener(event, resolve, { once: true });
  });

  await test(iframe.contentWindow, iframe.contentDocument);

  iframe.remove();
}

function changeFieldValue(field, value) {
  field.value = value;
  let win = field.ownerDocument.defaultView;
  field.dispatchEvent(
    new win.Event("change", {
      bubbles: true
    })
  );
}

const fixtures = {
  phabricator: {
    dashboardHtmlWithReviews: `
      <html>
        <body>
          <div class="phabricator-main-menu-user">
            <a href="/p/testuser/">testuser</a>
          </div>
          <table class="phui-object-item-list-view">
            <tr class="phui-object-item">
              <td><a href="/D12345">D12345: Test Review</a></td>
            </tr>
          </table>
        </body>
      </html>
    `,
    dashboardHtmlEmpty: `
      <html>
        <body>
          <div class="phabricator-main-menu-user">
            <a href="/p/testuser/">testuser</a>
          </div>
        </body>
      </html>
    `,
    cookie: {
      name: "phsid",
      value: "test-session-id",
      domain: "phabricator.services.mozilla.com"
    }
  },
  bugzilla: {
    apiSuccessResponse: {
      result: {
        requestee: [
          {
            id: 1,
            bug_id: 123456,
            type: "review",
            status: "?",
            requestee: "reviewer@example.com"
          },
          {
            id: 2,
            bug_id: 123456,
            type: "needinfo",
            status: "?",
            requestee: "reviewer@example.com"
          },
          {
            id: 3,
            bug_id: 789012,
            type: "review",
            status: "?",
            requestee: "reviewer@example.com"
          }
        ]
      }
    },
    apiEmptyResponse: {
      result: {
        requestee: []
      }
    },
    apiErrorResponse: {
      error: true,
      code: 306,
      message: "The API key you specified is invalid."
    }
  },
  github: {
    searchSuccessResponse: {
      total_count: 2,
      items: [
        {
          id: 1,
          number: 100,
          title: "Test PR 1",
          html_url: "https://github.com/owner/repo1/pull/100",
          repository_url: "https://api.github.com/repos/owner/repo1",
          user: { login: "author1" },
          draft: false
        },
        {
          id: 2,
          number: 200,
          title: "Test PR 2",
          html_url: "https://github.com/owner/repo2/pull/200",
          repository_url: "https://api.github.com/repos/owner/repo2",
          user: { login: "author2" },
          draft: false
        }
      ]
    },
    searchEmptyResponse: {
      total_count: 0,
      items: []
    }
  }
};

function createMockService(type, overrides = {}) {
  const defaultSettings = {
    phabricator: {
      container: 0,
      inclReviewerGroups: true
    },
    bugzilla: {
      apiKey: "test-api-key-12345",
      needinfo: true
    },
    github: {
      username: "testuser",
      ignoredUsers: "",
      ignoredRepos: ""
    }
  };

  return {
    id: overrides.id || 1,
    type,
    settings: { ...defaultSettings[type], ...overrides }
  };
}

function createBrowserMock() {
  const browser = window.chrome;

  return {
    setupDefaultMocks() {
      browser.storage.local.get
        .withArgs("featureRev")
        .returns(Promise.resolve({}));
      browser.storage.local.set.returns(Promise.resolve({}));
      browser.storage.local.get
        .withArgs("updateInterval")
        .returns(Promise.resolve({}));
      browser.storage.local.get
        .withArgs("services")
        .returns(Promise.resolve({}));
      browser.storage.local.get
        .withArgs("workingHours")
        .returns(Promise.resolve({}));
      browser.storage.local.get
        .withArgs("needsGitHubMigration")
        .returns(Promise.resolve({}));

      if (!browser.action) {
        browser.action = {
          setBadgeText: sinon.stub().returns(Promise.resolve()),
          setBadgeBackgroundColor: sinon.stub().returns(Promise.resolve())
        };
      }
    },

    setupWithServices(services) {
      this.setupDefaultMocks();
      browser.storage.local.get
        .withArgs("services")
        .returns(Promise.resolve({ services }));
    }
  };
}

function createFetchMock(sandbox) {
  return {
    respondWithJson(url, response) {
      sandbox.stub(window, "fetch").callsFake((fetchUrl) => {
        let urlString =
          typeof fetchUrl === "string"
            ? fetchUrl
            : fetchUrl.url || fetchUrl.toString();
        if (urlString.includes(url)) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => response
          });
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          text: async () => "Not found"
        });
      });
    },

    respondWithText(url, text) {
      sandbox.stub(window, "fetch").callsFake((fetchUrl) => {
        let urlString =
          typeof fetchUrl === "string"
            ? fetchUrl
            : fetchUrl.url || fetchUrl.toString();
        if (urlString.includes(url)) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => text
          });
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          text: async () => "Not found"
        });
      });
    },

    respondWithError(status = 500, message = "Server error") {
      sandbox.stub(window, "fetch").resolves({
        ok: false,
        status,
        text: async () => message
      });
    }
  };
}

/**
 * Creates standard test suite for BaseService interface methods.
 * Generates tests for isConfigured(), getDashboardUrl(), and getType().
 *
 * @param {Function} getService - Function that returns the service instance to test
 * @param {Object} options - Test configuration
 * @param {string} options.serviceType - Expected return value from getType()
 * @param {string} options.dashboardUrl - Expected dashboard URL
 * @param {string} options.configKey - The settings key that determines if service is configured (e.g., "apiKey", "username")
 * @param {string} options.configTestValue - A valid value for the config key
 */
function describeBaseServiceTests(getService, options) {
  const { serviceType, dashboardUrl, configKey, configTestValue } = options;

  describe("isConfigured()", function () {
    it(`should return true when ${configKey} is set`, function () {
      let settings = { [configKey]: configTestValue };
      assert.ok(getService().isConfigured(settings));
    });

    it(`should return false when ${configKey} is missing`, function () {
      let settings = { [configKey]: "" };
      assert.ok(!getService().isConfigured(settings));
    });

    it(`should return false when ${configKey} is undefined`, function () {
      let settings = {};
      assert.ok(!getService().isConfigured(settings));
    });
  });

  describe("getDashboardUrl()", function () {
    it("should return dashboard URL", function () {
      let url = getService().getDashboardUrl({});
      assert.equal(url, dashboardUrl);
    });
  });

  describe("getType()", function () {
    it(`should return '${serviceType}'`, function () {
      assert.equal(getService().getType(), serviceType);
    });
  });
}

/**
 * Sets up a Sinon sandbox in beforeEach and tears it down in afterEach.
 * Returns an object with the sandbox reference that will be populated during setup.
 *
 * @param {Object} context - The test suite context (typically `this`)
 * @returns {Object} Object with sandbox property that will contain the Sinon sandbox
 */
function setupTestSandbox(context) {
  const sandboxContainer = { sandbox: null };

  context.beforeEach(function () {
    sandboxContainer.sandbox = sinon.createSandbox();
  });

  context.afterEach(function () {
    sandboxContainer.sandbox.restore();
  });

  return sandboxContainer;
}

/**
 * Creates a mock fetch response that calls a callback with the request details
 * before returning the response. Useful for inspecting request parameters.
 *
 * @param {Object} sandbox - Sinon sandbox
 * @param {Function} inspector - Function called with (url, options) for each fetch call
 * @param {Object} response - The response object to return
 * @returns {sinon.stub} The stubbed fetch function
 */
function createInspectableFetch(sandbox, inspector, response) {
  return sandbox.stub(window, "fetch").callsFake(async (url, options) => {
    inspector(url, options);
    return response;
  });
}

export {
  loadPage,
  changeFieldValue,
  fixtures,
  createMockService,
  createBrowserMock,
  createFetchMock,
  describeBaseServiceTests,
  setupTestSandbox,
  createInspectableFetch
};
