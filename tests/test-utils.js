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
 *         test (async function(content)):
 *           The test function that accepts a single argument, which is
 *           the content window for the loaded iframe. When this function
 *           is called, the load event has already fired in the document.
 */
async function loadPage({ url, setup, test }) {
  let iframe = document.createElement('iframe');
  // Karma hosts these files at http://localhost/base/ + file path.
  // See http://karma-runner.github.io/3.0/config/files.html
  iframe.src = "base" + url;
  document.body.appendChild(iframe);
  let browser = chrome;

  // Reset sinon-chrome
  browser.flush();
  if (setup) {
    await setup(browser);
  }

  iframe.contentWindow.browser = chrome;

  await new Promise(resolve => {
    iframe.addEventListener("load", resolve, { once: true });
  });

  await test(iframe.contentWindow);

  iframe.remove();
}
