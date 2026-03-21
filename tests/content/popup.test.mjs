import { loadPage } from "../test-utils.mjs";

const browser = window.chrome;

describe("Popup", function () {
  let sandbox;

  beforeEach(async function () {
    sandbox = sinon.createSandbox();
  });

  afterEach(async function () {
    browser.flush();
    sandbox.restore();
  });

  it("should read states from storage instead of messaging", async () => {
    const mockStates = [
      [
        1,
        {
          type: "phabricator",
          data: {
            reviewTotal: 5,
            userReviewTotal: 3,
            groupReviewTotal: 2,
            connected: true
          }
        }
      ],
      [
        2,
        {
          type: "github",
          data: { reviewTotal: 2, reviewUrl: "https://github.com/pulls" }
        }
      ]
    ];

    await loadPage({
      url: "/addon/content/popup/popup.html",
      setup: async (browser) => {
        browser.storage.local.get
          .withArgs("reviewStates")
          .returns(Promise.resolve({ reviewStates: mockStates }));
        browser.storage.local.get
          .withArgs("needsGitHubMigration")
          .returns(Promise.resolve({}));
        browser.runtime.sendMessage
          .withArgs({ name: "get-feature-rev" })
          .returns(Promise.resolve({ newFeatures: false, featureRev: 4 }));
      },
      test: async (win, doc) => {
        // Verify storage.get was called for reviewStates
        assert.ok(
          browser.storage.local.get.calledWith("reviewStates"),
          "Should read reviewStates from storage"
        );

        // Verify we did NOT send a get-states message
        assert.ok(
          !browser.runtime.sendMessage.calledWith({ name: "get-states" }),
          "Should not send get-states message"
        );

        // Verify the counts are displayed
        let popupPage = doc.querySelector("popup-page");
        const phabCount = popupPage.shadowRoot.getElementById(
          "phabricator-user-review-num"
        ).textContent;
        const githubCount =
          popupPage.shadowRoot.getElementById("github-review-num").textContent;

        assert.equal(phabCount, "3", "Should display Phabricator count");
        assert.equal(githubCount, "2", "Should display GitHub count");
      }
    });
  });

  it("should handle missing reviewStates in storage gracefully", async () => {
    await loadPage({
      url: "/addon/content/popup/popup.html",
      setup: async (browser) => {
        browser.storage.local.get
          .withArgs("reviewStates")
          .returns(Promise.resolve({})); // No reviewStates
        browser.storage.local.get
          .withArgs("needsGitHubMigration")
          .returns(Promise.resolve({}));
        browser.runtime.sendMessage
          .withArgs({ name: "get-feature-rev" })
          .returns(Promise.resolve({ newFeatures: false, featureRev: 4 }));
      },
      test: async (win, doc) => {
        let popupPage = doc.querySelector("popup-page");
        const status = popupPage.shadowRoot.getElementById("status").textContent;
        assert.equal(status, "Nothing to do! \\o/", "Should show nothing to do");
      }
    });
  });

  it("should send refresh message when refresh button clicked", async () => {
    await loadPage({
      url: "/addon/content/popup/popup.html",
      setup: async (browser) => {
        browser.storage.local.get
          .withArgs("reviewStates")
          .returns(Promise.resolve({ reviewStates: [] }));
        browser.storage.local.get
          .withArgs("needsGitHubMigration")
          .returns(Promise.resolve({}));
        browser.runtime.sendMessage
          .withArgs({ name: "get-feature-rev" })
          .returns(Promise.resolve({ newFeatures: false, featureRev: 4 }));
        browser.runtime.sendMessage
          .withArgs({ name: "refresh" })
          .returns(Promise.resolve());
      },
      test: async (win, doc) => {
        // Click refresh button
        let popupPage = doc.querySelector("popup-page");
        const refreshButton = popupPage.shadowRoot.getElementById("refresh");
        refreshButton.click();

        // Verify refresh message was sent to background script
        assert.ok(
          browser.runtime.sendMessage.calledWith({ name: "refresh" }),
          "Should send refresh message"
        );
      }
    });
  });
});
