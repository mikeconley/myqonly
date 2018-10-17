# MyQOnly

[Install from AMO here.](https://addons.mozilla.org/en-US/firefox/addon/myqonly/)

Suggestions for a better name welcome!

This WebExtension attempts to provide a reasonably accurate count of how many reviews a Mozillian might have in their queue. It knows how to talk to Phabricator, Bugzilla and GitHub. It displays a badge in the toolbar showing how many reviews are in the queue, and the popup takes you to the dashboards for those two review tools.

# Usage

## Phabricator

MyQOnly will use any pre-existing browser session to get at your Phabricator data, so just login to Phabricator, and stay logged in.

## Bugzilla

You'll need to generate an API key. Visit [the API keys](https://bugzilla.mozilla.org/userprefs.cgi?tab=apikey) section of Bugzilla Preferences to generate a new key.

Once you have that API key, go to about:addons and visit the Preferences for MyQOnly. Paste in the API key, and set the update interval to your liking.

## GitHub
You need to enter your GitHub username into the about:addons preferences in MyQOnly.

# YMMV

This is still very much a WIP, so it might not work perfectly. Please file bugs!
