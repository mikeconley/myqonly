# MyQOnly Tests

This directory contains the test suite for the MyQOnly Firefox extension.

## Test Framework

The tests use the following frameworks:

- **Karma**: Test runner that executes tests in real browsers
- **Mocha**: Test framework providing `describe` and `it` blocks
- **Chai**: Assertion library with `assert` and `should` styles
- **Sinon**: Mocking and stubbing library
- **sinon-chrome**: WebExtension API mocks for testing

## Running Tests

Run all tests:

```bash
yarn test
```

If Firefox is not in your PATH, you can specify the Firefox binary location:

```bash
FIREFOX_BIN=/Applications/Firefox.app/Contents/MacOS/firefox yarn test
```

This command runs tests in Firefox using Karma. Tests run in single-run mode and exit after completion.

## Test Structure

### background.test.js

Tests for the main background script (`addon/background.js`). Covers:

- Extension initialization with default settings
- Service management (Phabricator, Bugzilla, GitHub)
- GitHub repository format migration detection
- Storage and alarm management

### content/options.test.js

Tests for the options page UI (`addon/content/options/options.html`). Covers:

- Update interval configuration
- Service-specific settings (API keys, usernames, etc.)
- Working hours feature
- GitHub migration warning and helper dialog

### services/

Tests for individual service integrations:

- `phabricator/phabricator.test.js`: Tests parsing of Phabricator dashboard HTML

Each service test directory may include HTML fixtures for testing parsing logic.

## Test Utilities

### loadPage(options)

Helper function for testing UI components. Loads a page in an iframe, sets up mocks, and runs test assertions.

**Parameters:**

- `url` (string): Path to the HTML file to load
- `setup` (async function): Optional setup function that prepares sinon-chrome mocks
- `waitForInitted` (boolean): Wait for custom "initted" event (default: true)
- `test` (async function): Test function that receives content window and document

**Example:**

```javascript
await loadPage({
  url: "/addon/content/options/options.html",
  setup: async (browser) => {
    browser.storage.local.get
      .withArgs("updateInterval")
      .returns(Promise.resolve({ updateInterval: 5 }));
  },
  test: async (content, document) => {
    let field = document.getElementById("update-interval");
    assert.equal(field.value, 5);
  }
});
```

### changeFieldValue(field, value)

Helper function for simulating user input on form fields.

**Parameters:**

- `field` (HTMLElement): The input element to change
- `value` (any): The new value to set

**Example:**

```javascript
let field = document.getElementById("github-username");
changeFieldValue(field, "newusername");
```

## Writing New Tests

### Background Script Tests

1. Create sinon sandboxes in `beforeEach` and restore in `afterEach`
2. Stub `window.fetch` to prevent real network calls
3. Mock `browser.storage.local.get` for any settings the code reads
4. Mock `browser.storage.local.set` to capture writes
5. Call `MyQOnly.init()` to initialize the extension
6. Assert on storage calls, internal state, or return values

### UI Component Tests

1. Use `loadPage()` to load the HTML file
2. Set up storage mocks in the `setup` function
3. Query the DOM and assert on element states
4. Use `changeFieldValue()` to simulate user interactions
5. Assert on storage calls to verify settings are saved

### Service Integration Tests

1. Create HTML fixtures in `tests/services/[service-name]/`
2. Call service methods with `testingURL` parameter
3. Assert on parsed results (review counts, etc.)

## Common Patterns

### Stubbing Storage

```javascript
browser.storage.local.get
  .withArgs("services")
  .returns(
    Promise.resolve({
      services: [
        {
          id: 1,
          type: "github",
          settings: { username: "testuser" }
        }
      ]
    })
  );
```

### Asserting Storage Writes

```javascript
assert.ok(
  browser.storage.local.set.calledWith({
    updateInterval: 10
  })
);
```

### Using Sinon Sandboxes

```javascript
let sandbox;

beforeEach(function () {
  sandbox = sinon.createSandbox();
  sandbox.stub(window, "fetch").resolves({ ok: false });
});

afterEach(function () {
  sandbox.restore();
});
```

## Available Globals

The following globals are available in all test files (configured in `.eslintrc.js`):

- `describe`, `beforeEach`, `afterEach`, `it`: Mocha test functions
- `assert`, `should`: Chai assertion functions
- `browser`, `chrome`: WebExtension API mocks
- `MyQOnly`: Main extension object
- `sinon`: Sinon mocking library

## Configuration

Test configuration is in `karma.conf.js` at the project root. Key settings:

- Browser: Firefox
- Frameworks: Mocha, Chai
- Files: Includes all source files, test files, and HTML fixtures
- Single run: Tests exit after completion
