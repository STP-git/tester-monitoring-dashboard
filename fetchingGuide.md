# AI Developer Guide: Data Fetching for Monitoring Dashboard

This document outlines the strategy and specific selectors needed to extract data from the `sHTML.txt` file. The goal is to parse this static HTML to gather all necessary information for building a dynamic, real-time monitoring web application.

## 🎯 Primary Goal

To create a structured dataset representing the state of the hardware test station, including overall status, details for each test slot, and complete information for each unit under test.

---

## 1. General Page & Configuration Data

This data provides the overall context and configuration of the test station.

| Data Point              | CSS Selector / Method                                                                                                                              | How to Extract                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Page Title** | `title`                                                                                                                                            | Get the element's `textContent`.                                                                                    |
| **Station Name** | `div.container > div.row > div.col-3 > button`                                                                                                     | Get the element's `textContent`.                                                                                    |
| **Configuration Vars** | Parse the final `<script>` tag in the `<body>`.                                                                                                    | Use string manipulation or regular expressions to extract the values of JS constants like `max_slots`, `test_station`, `interval`, etc. |

---

## 2. Test Status Summary

These are the main counters at the top of the page, providing a high-level overview. 

| Data Point          | CSS Selector          | How to Extract                 |
| ------------------- | --------------------- | ------------------------------ |
| **Testing Count** | `#testing-counter`    | Get the element's `textContent`. |
| **Failing Count** | `#failing-counter`    | Get the element's `textContent`. |
| **Aborted Count** | `#aborted-counter`    | Get the element's `textContent`. |
| **Failed Count** | `#failed-counter`     | Get the element's `textContent`. |
| **Passed Count** | `#passed-counter`     | Get the element's `textContent`. |

---

## 3. Test Slot Grid Data (Visual Status)

This section covers the main grid of cards, which shows the live visual state of each test slot.

**Overall Strategy:**
First, select all the slot containers and loop through them.

- **Parent Selector for All Slots:** `div#uutList > div[id^="slot-"]`

Inside the loop for each `slot` element, use the following selectors to get detailed information.

| Data Point                | CSS Selector (relative to parent slot) | How to Extract                                                              |
| ------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| **Slot ID** | -                                      | Get the `id` attribute of the parent slot element (e.g., "slot-1").         |
| **Overall Status** | -                                      | Get the `class` attribute of the parent slot element and find the status word (e.g., "testing", "failing", "default"). |
| **Slot Name** | `.chassisname a`                       | Get the element's `textContent`.                                            |
| **Main Serial Number** | `.panel-body .slot-sn a`               | Get the element's `textContent`. This applies only to the main device.      |
| **Test Time** | `.testtime`                            | Get the element's `textContent`.                                            |
| **Sub-Slot Names** | `.panel-body a[href="javascript:void(0);"]` | Loop through these elements and get their `textContent`.                  |
| **Build Type & Version** | `.panel-footer .slot-sn.fw-bold`       | Get the `textContent` of the two elements found.                            |

---

## 4. Comprehensive Unit Data (⭐ Primary Data Source)

**This is the most important section.** The `DELIVERY-OUT` modal (`#checkoutbatch`) contains hidden `<input>` fields with a complete, structured record for every active unit. This is the most reliable source for building a complete data model.

**Overall Strategy:**
1.  Select all the form containers within the modal.
2.  Loop through each form.
3.  For each form, create a new data object for the unit.
4.  Iterate through all hidden inputs within that form, using their `name` and `value` to populate the object.

- **Parent Selector for All Unit Forms:** `div#checkoutbatch form[id^="message-add-"]`
- **Selector for All Data Fields:** `input[type="hidden"]`

**Key Data Fields to Extract from Hidden Inputs:**
For each form, you will find and extract the `value` of these inputs by their `name` attribute:
- `serial_number`
- `product_name`
- `product_number`
- `product_revision`
- `part_number`
- `part_revision`
- `test_mode`
- `code_version`
- `operation`
- `username`
- `logop`
- `batch_id`
- `slot_location`
- `slot_no`
- `result` (e.g., "RUNNING")
- `message` (e.g., "PSU test FAILED")
- `test_fail` (specific test step that failed)

---

## ✅ Recommended Implementation Strategy

To build a robust application, follow this two-pass approach:

1.  **First Pass (Data Foundation):**
    -   Parse the **Comprehensive Unit Data** from the `#checkoutbatch` modal first. This gives you a complete and structured list of all units and their detailed properties. Create your primary data objects from this source.

2.  **Second Pass (Visual Enrichment):**
    -   Parse the **Test Slot Grid Data**. Use the `Slot Name` or `Serial Number` to match these visual cards to the data objects you created in the first pass.
    -   Use this pass to update the live visual state, such as the `Overall Status` ("testing", "failing") and the current `Test Time`.

3.  **Final Pass (General Info):**
    -   Fetch the **General Page & Configuration Data** and the **Test Status Summary** counts to display on the main dashboard UI.