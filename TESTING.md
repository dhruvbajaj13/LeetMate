# 🧪 Testing Guide for LeetCode Helper

This document provides guidance on how to manually test the LeetCode Helper extension during development. 🚀

## 📋 Prerequisites

Before testing, ensure that:

1.  You have a valid Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
2.  You have installed the extension in Chrome developer mode (`chrome://extensions/` -> Load unpacked).
3.  You have configured and saved a valid API key via the extension's popup. The popup status should be green, and the toolbar icon should be enabled.

## 🔍 Manual Testing Steps

### 1. Installation and Configuration

*(These steps verify the basic setup)*

1.  **Install/Reload:** Load or reload the extension via `chrome://extensions/`. Check for manifest errors.
2.  **Open Popup:** Click the extension icon in the toolbar.
3.  **Save Invalid Key:** Enter an obviously invalid key (e.g., "test") and click Save. Verify an error message appears, status stays red/disconnected, and the icon remains disabled.
4.  **Save Valid Key:** Enter your real Gemini API key and click Save.
    *   Verify the "Validating..." message appears.
    *   Verify the status indicator turns green, the text updates to "Gemini API configured...", and the toolbar icon changes to the green enabled state.
5.  **Re-open Popup:** Close and reopen the popup. Verify the configured state persists.
6.  **Check Connection:** Click the "Check Connection" button. Verify it confirms the configured status.

### 2. Basic Hint Generation ("Get Hint" Button)

*(These steps test the original functionality without test case analysis)*

1.  **Navigate:** Go to any LeetCode problem (e.g., `/problems/two-sum/`). Verify the overlay appears.
2.  **Empty Editor:** Click "<i class="fa-solid fa-wand-magic-sparkles"></i> Get Hint" with an empty editor. Verify a reasonable response (e.g., hints on how to start).
3.  **Partial Code:** Write some incomplete code (e.g., just a function signature). Click "Get Hint". Verify hints guide you on the next steps. Check console (F12) for code extraction logs.
4.  **Plausible Code:** Write code that attempts the solution (correct or incorrect). Click "Get Hint".
    *   Verify the loading spinner appears.
    *   Verify hints, bugs, and optimizations are displayed within a reasonable time (e.g., 3-10 seconds).
    *   Verify the content seems relevant to the code provided.
    *   Test collapsing/expanding the 💡, 🐛, ⚡ sections.
5.  **Minimize/Maximize:** Test the toggle button (`-`/`+`) on the overlay header while idle and while loading a hint.

### 3. Advanced Hint Generation ("Hint (Auto-Test)" Button)

*(These steps test the new feature integrating test execution)*

1.  **Navigate:** Go to a LeetCode problem.
2.  **Empty Editor:** Click "<i class="fa-solid fa-vial-circle-check"></i> Hint (Auto-Test)".
    *   It should still attempt to run the code (which will likely fail immediately on LeetCode).
    *   Check the console (F12) for logs from `testcase.js` attempting to run and parse results.
    *   Verify the hint eventually displayed acknowledges the code is empty or likely failed execution.
3.  **Code with Runtime Error:** Write code that will cause a runtime error (e.g., `a = 1 / 0`, accessing `null.property`). Click "Hint (Auto-Test)".
    *   Verify the loading text updates (e.g., "Running tests...", "Getting hint...").
    *   Check console logs for `testcase.js` detecting the error state and extracting error details/last input.
    *   Verify the final hint **explicitly mentions the runtime error** found in the `🐛 Bugs & Failing Tests` section, potentially referencing the `errorDetails` from the parsed results.
4.  **Code Failing Some Test Cases:** Write code that is logically incorrect for some inputs (e.g., Two Sum solution that doesn't handle duplicates correctly if the test cases include them). Click "Hint (Auto-Test)".
    *   Verify loading states and console logs showing test case parsing.
    *   Verify the final hint **specifically mentions the failing test cases** in the `🐛 Bugs & Failing Tests` section, ideally referencing the Input, Output, and Expected values parsed by `testcase.js`.
5.  **Correct Code:** Write a fully correct solution that passes all test cases. Click "Hint (Auto-Test)".
    *   Verify loading states and console logs showing test case parsing (all should have `match: true`).
    *   Verify the `🐛 Bugs & Failing Tests` section states something like "No bugs detected based on the provided test results."
    *   Verify the `💡 Hints` and `⚡ Optimization Tips` focus on explaining the solution, discussing complexity, or suggesting alternatives/refinements.
6.  **Time Limit Exceeded (Harder to test manually):** If you have code that might TLE, run "Hint (Auto-Test)". Check if `testcase.js` logs "Time Limit Exceeded" as the `consoleOutput` and if the Gemini hint mentions potential performance issues.

## 🔧 Testing Specific Scenarios & Edge Cases

*   **Different Problems:** Test on various problems (easy, medium, hard) with different input/output types (arrays, strings, numbers, lists, trees).
*   **Long Code/Descriptions:** Test with problems having very long descriptions or if you paste very long code (approaching the truncation limits) to ensure sanitization works.
*   **Rapid Clicks:** Click the hint buttons multiple times quickly. Ensure the UI handles loading states correctly and doesn't break.
*   **Network Interruption:** Use DevTools (Network tab -> Offline) to simulate network loss while waiting for a hint. Verify a proper error message is shown.
*   **Invalid API Key (After Success):** Configure a valid key, get a hint, then *change* the key in the popup to an invalid one, and try getting another hint. Verify it fails correctly.
*   **LeetCode UI Changes:** Be aware that if LeetCode updates its site structure, the selectors in `content.js` (for problem info) and `testcase.js` (for run button, results panels, test cases) might break. Testing involves checking if these extractions still work after known LeetCode updates.

## 🐞 Troubleshooting Common Issues

*   **API Key:** See README troubleshooting. Check popup status and console for API errors (4xx, 5xx status codes).
*   **Overlay/UI:** See README troubleshooting. Check console for JavaScript errors in `content.js` or `overlay.css` issues.
*   **Code Extraction:** Check console logs from `content.js`. Did `monaco-extractor.js` work, or did it fall back to DOM extraction? Is the fallback finding the code?
*   **Test Runner (`testcase.js`):**
    *   **Run Button Not Found:** Check the `selectors.runButton` in `testcase.js` against LeetCode's current HTML.
    *   **Timeout Waiting for Results:** LeetCode might be slow, or the `selectors.consoleResult` might be wrong, or the `MutationObserver` logic isn't detecting the change. Increase timeout in `testcase.js` for debugging.
    *   **Incorrect Parsing:** Check console logs. Did it detect the correct state (Error vs. Cases)? Are the selectors for error messages or test case elements (`Input`, `Output`, `Expected`, tabs) still valid? Add more `console.log` statements within `testcase.js` during parsing loops to see what data is being found.
*   **Hint Content Issues:** If hints seem irrelevant or badly formatted:
    *   Check the prompt being sent to Gemini (log it from `gemini-api.js`).
    *   Check the raw JSON response from Gemini (log it). Is Gemini following the format instructions and schema?
    *   Check the `formatTextWithCodeBlocks` function in `content.js`.

## 📊 Performance Testing

*   **Response Time:**
    *   Time the "<i class="fa-solid fa-wand-magic-sparkles"></i> Get Hint" button (should be faster, mainly Gemini API time).
    *   Time the "<i class="fa-solid fa-vial-circle-check"></i> Hint (Auto-Test)" button (will be longer, includes LeetCode run time + parsing time + Gemini API time). Note both times.
*   **UI Responsiveness:** Ensure the overlay can be minimized/maximized and scrolled smoothly even while waiting for either type of hint.

## 🛠️ Development Debugging Tips

1.  **Console is King:** Use `console.log`, `console.warn`, `console.error` liberally in `content.js`, `gemini-api.js`, and `testcase.js`. Check the correct console (the one for the LeetCode tab, not the popup or background).
2.  **Reload Extension:** After code changes, always reload the extension from `chrome://extensions/` (click the reload icon). Refresh the LeetCode page (`Ctrl+R` or `Cmd+R`).
3.  **Inspect Elements:** Use DevTools (Elements tab) to inspect the overlay and LeetCode page elements. Verify selectors used in the code are correct.
4.  **Network Tab:** Monitor requests to `generativelanguage.googleapis.com`. Check request payload (is the prompt correct? Is the test data included?) and the response (status code, JSON body).
5.  **Debug `testcase.js`:** Add `debugger;` statements inside `testcase.js` and use the DevTools Sources panel to step through the code execution, especially the parsing logic, while a LeetCode run is completing.
6.  **Isolate API Calls:** Use tools like `curl` or Postman to send the exact same prompt (logged from `gemini-api.js`) directly to the Gemini API endpoint. This helps determine if issues lie in the extension's logic or the AI's response generation. 