# Building the WebExtension

We use [yarn](https://yarnpkg.com/) as package manager, so make sure you have that installed and available in your path.

Then install the development dependencies by running `yarn install`.

You can install the development version of MyQOnly by visiting `about:debugging` within Firefox, clicking "Load Temporary Add-on", and then browsing to the `manifest.json` file inside of the `addon/` directory.

You can build an (unsigned) XPI of MyQOnly by running `yarn build`.

# Linting

[ESLint](https://eslint.org/) is used to keep our JavaScript consistent and tidy. You can run ESLint on the whole project (which will be installed when installing the development dependencies) by using `yarn lint`.

You can lint an individual file or directory by using `yarn lint-file <path>`.

# Testing

[sinon-chrome](https://www.npmjs.com/package/sinon-chrome) is used to mock out the WebExtension APIs, and some (very) basic unit tests exist within the test directory. You can run those tests with `yarn test`.

You may need to set the `FIREFOX_BIN` environment variable, pointed at a local Firefox instance in order for the Karma launcher to launch it.

Manual testing can be done by running `yarn test:manual`, which will open up a fresh instance of Firefox with MyQOnly installed.

# Debugging

MyQOnly has a very simple debugging interface built into it. Visit the Options page, and then hover your mouse down to the bottom right of the screen to expose a link to it. Right now, it allows you to trigger a manual refresh of the review count, as well as gather a current snapshot of the Phabricator dashboard for the user, which will hopefully be useful for testing and bug reproduction.

# Issues and Pull Requests

If you're going to send a pull request, please ensure that an [issue](https://github.com/mikeconley/myqonly/issues) has been filed for the work you're doing.

Please ask [mikeconley](https://github.com/mikeconley/) to review your pull requests.