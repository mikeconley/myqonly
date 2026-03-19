import { playwrightLauncher } from "@web/test-runner-playwright";

const firefoxPath = process.env.FIREFOX_BIN;

export default {
  nodeResolve: false,
  files: ["tests/**/*.mjs"],
  browsers: [
    playwrightLauncher({
      product: "firefox",
      launchOptions: {
        headless: true,
        ...(firefoxPath && { executablePath: firefoxPath })
      }
    })
  ],
  testFramework: {
    config: {
      ui: "bdd",
      timeout: 10000
    }
  },
  testRunnerHtml: (testFramework) =>
    `<!DOCTYPE html>
    <html>
      <head>
        <script src="/node_modules/sinon/pkg/sinon.js"></script>
        <script src="/node_modules/sinon-chrome/bundle/sinon-chrome-webextensions.min.js"></script>
        <script src="/node_modules/chai/chai.js"></script>
        <script>window.assert = chai.assert; window.should = chai.should();</script>
      </head>
      <body>
        <script type="module" src="${testFramework}"></script>
      </body>
    </html>`,
  coverage: false,
  concurrency: 10,
  browserStartTimeout: 30000,
  testsStartTimeout: 10000,
  testsFinishTimeout: 20000
};
