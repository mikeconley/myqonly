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
async function loadPage({ url, setup, waitForInitted = true, test }) {
  let iframe = document.createElement("iframe");
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
  iframe.contentWindow.console = console;

  await new Promise(resolve => {
    let event = waitForInitted ? "initted" : "load";
    iframe.contentWindow.addEventListener(event, resolve, { once: true });
  });

  await test(iframe.contentWindow, iframe.contentDocument);

  iframe.remove();
}

function changeFieldValue(field, value) {
  field.value = value;
  let win = field.ownerDocument.defaultView;
  field.dispatchEvent(new win.Event("change", {
    bubbles: true,
  }));
}
