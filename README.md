# MyQOnly

Suggestions for a better name welcome!

This WebExtension attempts to provide a reasonably accurate count of how many reviews a Mozillian might have in their queue. It knows how to talk to Phabricator and Bugzilla. It displays a badge in the toolbar showing how many reviews are in the queue, and the popup takes you to the dashboards for those two review tools.

# Usage

You'll need to generate API keys for Phabricator and Bugzilla.

For [Phabricator](https://phabricator.services.mozilla.com/), you can do this by visiting your `Settings` page, and clicking on `Conduit API Tokens`. From there, you can generate a new key.

For Bugzilla, visit [the API keys](https://bugzilla.mozilla.org/userprefs.cgi?tab=apikey) section of Bugzilla Preferences and generate a new key.

Once you have those API keys, go to about:addons and visit the Preferences for MyQOnly. Paste in the API keys, and set the update interval to your liking.

This is still very much a WIP, so it might not work perfectly. Please file bugs!