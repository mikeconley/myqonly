/* globals loadPage, changeFieldValue */

describe("Options page", function() {
  it("should show stored interval time, and be able to update", async function() {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: async(browser) => {
        browser.storage.local.get.withArgs("updateInterval").returns(
          Promise.resolve({ updateInterval: DEFAULT_UPDATE_INTERVAL, })
        );
        browser.storage.local.get.withArgs("userKeys").returns(
          Promise.resolve({})
        );
        browser.storage.local.get.withArgs({ workingHours: {}, }).returns(
          Promise.resolve({})
        );
      },
      test: async(content, document) => {
        let field = document.getElementById("update-interval");
        parseInt(field.value, 10).should.equal(DEFAULT_UPDATE_INTERVAL);

        // Now update the value
        let newInterval = DEFAULT_UPDATE_INTERVAL + 1;
        browser.storage.local.set.withArgs({ updateInterval: undefined, }).returns(
          Promise.resolve()
        );
        changeFieldValue(field, newInterval);
        assert.ok(browser.storage.local.set.calledOnce);
        assert.ok(browser.storage.local.set.calledWith({ updateInterval: newInterval, }));
      },
    });
  });
});

const WEEKENDS = [
  "saturday",
  "sunday",
];

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
];

describe("Options page", function() {
  it("should be able to set working hours from default state", async function() {
    await loadPage({
      url: "/addon/content/options/options.html",
      setup: async(browser) => {
        browser.storage.local.get.withArgs("updateInterval").returns(
          Promise.resolve({ updateInterval: DEFAULT_UPDATE_INTERVAL, })
        );
        browser.storage.local.get.withArgs("userKeys").returns(
          Promise.resolve({})
        );
        // Default to no working hours
        browser.storage.local.get.withArgs({ workingHours: {}, }).returns(
          Promise.resolve({})
        );
      },
      test: async(content, document) => {
        // By default, the working hours fields should be disabled.
        let fieldset = document.getElementById("working-hours-fields");
        assert.ok(fieldset.disabled);

        // Default workday is 9-5, in HH:MM.
        let startTime = document.getElementById("start-time").value;
        assert.equal(startTime, "09:00");
        let endTime = document.getElementById("end-time").value;
        assert.equal(endTime, "17:00");

        // Monday-Friday should be checked by default, weekends not checked.
        let boxes = fieldset.querySelectorAll("input[type='checkbox']");
        assert.equal(boxes.length, WEEKDAYS.length + WEEKENDS.length);
        for (let box of boxes) {
          if (WEEKDAYS.includes(box.id)) {
            assert.ok(box.checked);
          } else if (WEEKENDS.includes(box.id)) {
            assert.ok(!box.checked);
          } else {
            assert.ok(false, "Did not expect a checkbox with id: " + box.id);
          }
        }

        let checkbox = document.getElementById("working-hours-checkbox");
        checkbox.click();
        assert.ok(!fieldset.hasAttribute("disabled"));

        assert.ok(browser.storage.local.set.calledOnce);
        assert.ok(browser.storage.local.set.calledWith({
          workingHours: {
            enabled: true,
            days: WEEKDAYS,
            startTime: "09:00",
            endTime: "17:00",
          },
        }));
      },
    });
  });
});