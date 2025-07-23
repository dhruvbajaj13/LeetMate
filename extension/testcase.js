async function getLeetCodeTestSummaryJSON() {
    // Configuration for CSS selectors - central place for updates if LeetCode UI changes
    const selectors = {
        runButton: '[data-e2e-locator="console-run-button"]',
        consoleResult: '[data-e2e-locator="console-result"]',
        // Selectors for Error Details Extraction
        errorResultParentContainer: '.space-y-4', // Common parent for specific error message
        specificErrorMsg: '.font-menlo[class*="text-red-"], .font-menlo[class*="text-error"], .font-menlo[class*="dark:text-red-"]', // Specific error text element
        statusParentContainerFallback: 'div.flex', // Parent of status text used for fallback search
        errorContainerFallback1: 'div.group.relative[class*="bg-red"], div[class*="text-red"], div[class*="color: rgb(239, 68, 68)"]', // Broader error container selector (within status parent sibling)
        errorContainerFallback2: 'div.group.relative[class*="bg-red"], div[class*="text-red-"], div[class*="text-error"], div[class*="color: rgb(239, 68, 68)"]', // Document-wide error container fallback
        // Selectors for Last Executed Input
        lastInputLabel: 'div.text-xs.font-medium, div.text-label-3', // Label element containing "Last Executed Input"
        lastInputPossibleContainer1: 'div.space-y-2', // Common container class for multiple inputs
        lastInputMenlo: '.font-menlo', // The element typically containing code/input text
        lastInputExcludeErrorStyle: '[class*="text-red-"], [class*="text-error"], [class*="dark:text-red-"]', // Selector to filter out error-styled text within input section
        lastInputParamWrapper: '.group.relative', // Container usually holding both label and value for a single input parameter
        lastInputParamLabel: '.text-xs.text-label-3, .text-xs[class*="label-3"]', // Label for a specific parameter (e.g., 'nums =')
        // Selectors for Test Case Tabs and Panels
        potentialCaseTabs: 'div[class*="cursor-pointer"], button[class*="group"]', // Broad selector for elements that *might* be case tabs
        panelLabel: '.mb-2.text-xs.font-medium, .text-xs.font-medium, .flex.text-xs.font-medium', // Labels like "Input", "Output", "Expected"
        panelValueContainerFallback1: '.space-y-2, .group.relative, [class*="bg-fill-"]', // Potential containers next to the label
        panelValueContainerFallback2: '.space-y-2', // Specific container class often used
        panelValueMenlo: '.font-menlo', // Value element within panels
        panelGenericAncestor: '.group,[class^="tab-"],.space-y-4', // Ancestor container fallback for panel text search
        panelParamWrapper: '.group.relative', // Wrapper for multi-parameter input label+value
        panelParamLabel: '.text-xs.text-label-3, .text-xs[class*="label-3"]' // Label for multi-parameter input
    };

    // 1. Click Run
    console.log("Phase 1: Initiating Code Run...");
    const runButton = document.querySelector(selectors.runButton);
    if (runButton) {
        runButton.click();
        console.log("Run button clicked.");

        // *** ADDED DELAY ***
        // Wait briefly after clicking Run to allow the UI to clear old results
        // before starting the MutationObserver. Adjust delay if needed.
        const initialDelayMs = 500;
        console.log(`Waiting ${initialDelayMs}ms for UI to potentially clear old results...`);
        await new Promise(resolve => setTimeout(resolve, initialDelayMs));

    } else {
        console.error("Could not find the Run Code button! Cannot proceed.");
        // Return early with error object
        return { consoleOutput: "Error: Run Button Not Found", errorDetails: { message: "Could not find LeetCode's run button using selector: " + selectors.runButton, lastInput: null }, testCases: [] };
    }

    // 2. Wait for result panel using MutationObserver
    console.log("Phase 2: Waiting for results panel...");
    let consoleOutputElement;
    try {
        await new Promise((resolve, reject) => {
            const checkTimeoutMillis = 15000; // Increased timeout to 15 seconds
            let observer;
            let timeoutId;

            // Function to check if the results panel is ready
            const checkPanel = () => {
                consoleOutputElement = document.querySelector(selectors.consoleResult);
                // Check if element exists, has content, and is visible
                // Crucially, we also need to ensure it's not showing a stale result from the *previous* run.
                // We might need a more robust check here later if this is still problematic,
                // e.g., checking if a loading indicator is GONE or if the text content is *different*
                // from what it was right after the click. For now, the initial delay is the main fix.
                if (consoleOutputElement && consoleOutputElement.textContent.trim().length > 0 && consoleOutputElement.offsetParent !== null) {
                    // Add a check to see if the text looks like a loading state, if LeetCode uses one
                    const currentText = consoleOutputElement.textContent.trim().toLowerCase();
                    if (currentText.includes('running') || currentText.includes('pending')) {
                         console.log("Results panel shows loading state, continuing to wait...");
                         return false; // Not ready yet
                    }

                    console.log("Results panel populated and visible (and not obviously loading).");
                    if (observer) observer.disconnect(); // Stop observing
                    clearTimeout(timeoutId); // Clear the timeout
                    resolve(); // Promise resolved
                    return true;
                }
                return false;
            };

            // Initial check in case the panel is already there AND ready after the delay
            if (checkPanel()) return;

            // Set up the observer
            observer = new MutationObserver((mutations) => {
                // We don't need to inspect mutations in detail; just re-run the check
                // console.log("DOM change detected, checking for results panel..."); // Reduced console noise
                if (checkPanel()) {
                    // Resolved inside checkPanel
                }
            });

            // Start observing the body for subtree changes (broad, but necessary if we don't know the exact container)
            observer.observe(document.body, { childList: true, subtree: true, characterData: true }); // Added characterData for text changes
            console.log("MutationObserver started.");

            // Set up the timeout
            timeoutId = setTimeout(() => {
                if (observer) observer.disconnect(); // Stop observing on timeout
                console.error(`Timeout after ${checkTimeoutMillis}ms waiting for results panel.`);
                // Reject the promise
                reject(new Error(`Timeout waiting for results panel (${selectors.consoleResult})`));
            }, checkTimeoutMillis);
        });
    } catch (error) {
         // Return early if waiting failed (timeout or observer error)
         return { consoleOutput: "Error: Timeout or Observer Error", errorDetails: { message: error.message || "Timed out or error occurred while waiting for LeetCode results panel.", lastInput: null }, testCases: [] };
    }

    // 3. Analyze results
    console.log("Phase 3: Analyzing results...");
    // Ensure consoleOutputElement is valid before accessing textContent
    const consoleOutput = consoleOutputElement ? consoleOutputElement.textContent.trim() : "Unknown Result (Element not found after wait)";

    let errorDetails = null;
    let testCases = [];

    // Check for initial error state using case-insensitive comparison
    // Include "Wrong Answer" explicitly as a non-error state for case parsing
    const outputLower = consoleOutput.toLowerCase();
    if (outputLower.includes("error") || (outputLower.includes("fail") && !outputLower.includes("wrong answer"))) { // Refined error check
        console.warn(`Detected potential error state: ${consoleOutput}. Attempting to extract specific details...`);
        let errorMessage = consoleOutput; // Default to the main status message

        // *** Error Message Extraction Logic ***
        // Attempts to find a more specific error message than the general status text.
        // Strategy 1: Look within a common parent container for specifically styled error text.
        // Strategy 2 (Fallback): Look for specific error containers near the status text or globally.
        try {
            let specificErrorElement = null;
            // Find a common parent first to narrow the search scope
            const commonParent = consoleOutputElement?.closest(selectors.errorResultParentContainer);
            if (commonParent) {
                specificErrorElement = commonParent.querySelector(selectors.specificErrorMsg);
                if (specificErrorElement) {
                     console.log("Found specific error message element via common parent search.");
                     errorMessage = specificErrorElement.textContent.trim();
                } else {
                     console.warn("Could not find specific error message element via common parent. Will attempt fallback.");
                }
            } else {
                 console.warn("Could not find common parent container for error search using selector: " + selectors.errorResultParentContainer);
            }

            // Fallback if primary search failed or yielded the same message
            if (errorMessage === consoleOutput) {
                console.log("Attempting fallback error container search...");
                // Look near the original status element first
                const statusParent = consoleOutputElement?.closest(selectors.statusParentContainerFallback)?.parentElement;
                let errorContainer = statusParent?.querySelector(selectors.errorContainerFallback1);

                // If not found near status, try a broader document search (less reliable)
                if (!errorContainer) {
                     errorContainer = document.querySelector(selectors.errorContainerFallback2);
                     if(errorContainer) console.log("Used broader document search for fallback error container.");
                }

                if (errorContainer) {
                    console.log("Found fallback error container.");
                    let fallbackMessage = errorContainer.textContent?.trim() || "";
                    fallbackMessage = fallbackMessage.replace(/\s+/g, ' ').trim(); // Clean whitespace

                    // Use fallback only if it's meaningful and different from the main status
                    if (fallbackMessage && fallbackMessage.toLowerCase() !== consoleOutput.toLowerCase()) {
                         errorMessage = fallbackMessage;
                         console.log("Used fallback error container text content as error message."); // Changed from warn to log
                    } else {
                         console.warn("Fallback error container text was empty, whitespace, or same as status; using main status as message.");
                    }
                } else {
                     console.warn("Could not find any specific error details container (fallback also failed); using main status as error message.");
                }
            }
        } catch(e) {
            console.error("Error during specific error message extraction:", e);
            // Keep the default errorMessage if extraction fails
        }
        // *** END OF Error Message Extraction Logic ***


        // *** Last Executed Input Extraction Logic ***
        // Tries to find the input that caused the error.
        let lastInputText = "Last executed input not found.";
        try {
            // Find the label first
            const lastInputLabelElement = Array.from(document.querySelectorAll(selectors.lastInputLabel))
                                .find(el => el.textContent.trim().startsWith('Last Executed Input')); // Use startsWith for flexibility

            if (lastInputLabelElement) {
                // Strategies to find the container holding the input value(s) relative to the label
                let inputContainer = null;
                // Strategy 1: Check immediate next sibling
                if (lastInputLabelElement.nextElementSibling) {
                    inputContainer = lastInputLabelElement.nextElementSibling;
                }
                // Strategy 2: Check common container pattern within label's parent
                if (!inputContainer || !inputContainer.querySelector(selectors.lastInputMenlo)) {
                    const parent = lastInputLabelElement.parentElement;
                    inputContainer = parent ? parent.querySelector(selectors.lastInputPossibleContainer1) : null;
                }
                // Strategy 3: Check sibling of label's parent (fallback)
                if (!inputContainer || !inputContainer.querySelector(selectors.lastInputMenlo)) {
                    const parentSibling = lastInputLabelElement.parentElement?.nextElementSibling;
                    if(parentSibling?.querySelector(selectors.lastInputMenlo)) {
                        inputContainer = parentSibling;
                        console.log("Used parent's sibling for last input container (Fallback Strategy 3).");
                    }
                }

                if (inputContainer) {
                    // Find ALL potential code elements within the container
                    const allMenloElements = inputContainer.querySelectorAll(selectors.lastInputMenlo);

                    // *** FILTER OUT elements that look like error messages based on styling ***
                    // This is crucial because error details might appear alongside input in the DOM.
                    const inputElements = Array.from(allMenloElements).filter(el =>
                        !el.matches(selectors.lastInputExcludeErrorStyle)
                    );

                    if (inputElements.length === 0 && allMenloElements.length > 0) {
                        // This might happen if the only '.font-menlo' found was styled as an error.
                        console.warn(`Found '${selectors.lastInputMenlo}' elements, but all matched error style filters ('${selectors.lastInputExcludeErrorStyle}'). Attempting to use container text as fallback.`);
                        lastInputText = inputContainer.textContent?.replace(/[\s\uFEFF\xA0]+/g, ' ').trim() || "Filtered elements were empty.";
                    } else {
                        const inputs = [];
                        // Process only the filtered (non-error) elements
                        inputElements.forEach(el => {
                            let labelText = "";
                            // Try to find the parameter label (e.g., 'tops =') associated with this value
                            const valueWrapper = el.closest(selectors.lastInputParamWrapper);
                            if (valueWrapper) {
                                const labelEl = valueWrapper.querySelector(selectors.lastInputParamLabel);
                                if (labelEl) {
                                   labelText = labelEl.textContent.trim();
                                }
                            }
                            // Format label and value nicely
                            const separator = labelText ? (labelText.endsWith('=') ? ' ' : ' = ') : '';
                            inputs.push(`${labelText}${separator}${el.textContent.trim()}`);
                        });

                        if (inputs.length > 0) {
                            lastInputText = inputs.join('\n'); // Join multi-params with newline
                            console.log("Extracted last input details (multi-param aware, errors excluded).");
                        } else {
                           // This case means inputElements were found but processing failed to extract text,
                           // or the structure didn't match the label-finding logic.
                           lastInputText = "Input parameter values not found within elements.";
                           console.warn("Could not extract specific input parameter values after filtering, despite finding elements.");
                        }
                    }
                } else { console.warn("Could not find the specific container for last executed inputs relative to the label."); }
            } else { console.warn(`Could not find 'Last Executed Input' label using selector: ${selectors.lastInputLabel}`); }
        } catch(e) {
            console.error("Error during last executed input extraction:", e);
            lastInputText = "Error occurred during input extraction.";
        }
        // *** END OF Last Executed Input Extraction Logic ***

        errorDetails = { message: errorMessage, lastInput: lastInputText };
        testCases = []; // No test cases to parse in error state

    } else { // *** NO ERROR PATH ***
        console.log(`No initial error detected (Result: ${consoleOutput}). Proceeding to collect test cases...`);

        // Find potential clickable test case tabs/buttons
        const potentialTabs = document.querySelectorAll(selectors.potentialCaseTabs);
        // Filter for elements that look like "Case N" and are visible
        const caseButtons = Array.from(potentialTabs).filter(btn => {
             const textContent = (btn.textContent || "").trim();
             const hasCaseText = /^Case\s*\d+/i.test(textContent);
             // Check visibility using offsetParent - crucial to avoid hidden duplicates or non-interactive elements
             const isVisible = btn.offsetParent !== null;
             return hasCaseText && isVisible;
         });
        console.log(`Found ${caseButtons.length} potential visible case tabs.`);

        // Helper function to extract text from Input/Output/Expected panels for the *currently active* tab
        function getPanelText(label) {
            // Find the label element first
            const labelDiv = Array.from(document.querySelectorAll(selectors.panelLabel))
                .find(el => el.textContent.trim() === label);
            if (!labelDiv) { console.warn(`Label '${label}' not found using selector: ${selectors.panelLabel}`); return null; }

            // Strategies to find the container holding the value(s) associated with the label
            // This logic tries different common DOM structures LeetCode might use.
            let valueContainer = null;
            // 1. Check within the label's parent for a code element
            if (labelDiv.parentElement?.querySelector(selectors.panelValueMenlo)) {
                valueContainer = labelDiv.parentElement;
            }
            // 2. Check the next sibling element if it matches common container patterns
            if (!valueContainer && labelDiv.nextElementSibling?.matches(selectors.panelValueContainerFallback1)) {
                 valueContainer = labelDiv.nextElementSibling;
            }
            // 3. Check specifically for a '.space-y-2' container within the parent (common pattern)
             if (!valueContainer) {
                 valueContainer = labelDiv.parentElement?.querySelector(selectors.panelValueContainerFallback2);
             }
            // 4. Fallback specific to Output/Expected: check parent or next sibling for code element directly
            if (!valueContainer && (label === 'Output' || label === 'Expected')) {
                 valueContainer = labelDiv.parentElement?.querySelector(selectors.panelValueMenlo) || labelDiv.nextElementSibling?.querySelector(selectors.panelValueMenlo);
                 if (valueContainer) {
                     valueContainer = valueContainer.closest('div'); // Try to get the container div
                 }
            }
            // 5. Broad fallback: search up the ancestor tree for known grouping elements
            if (!valueContainer) {
                 const groupAncestor = labelDiv.closest(selectors.panelGenericAncestor);
                 if (groupAncestor) {
                     valueContainer = groupAncestor;
                     console.log(`Using ancestor search fallback for '${label}' container.`);
                 } else {
                     console.warn(`Value container for label '${label}' not reliably found using multiple strategies.`);
                     return null; // Give up if no container found
                 }
            }

            // Once a container is found, extract the code text from '.font-menlo' elements within it
            const valueElements = Array.from(valueContainer.querySelectorAll(selectors.panelValueMenlo));
            if (valueElements.length === 0) {
                 // Handle cases where the container *itself* might be the code element, or no code element exists
                 if (valueContainer.matches(selectors.panelValueMenlo)) {
                     valueElements.push(valueContainer); // Container is the value element
                 } else {
                     console.warn(`No '${selectors.panelValueMenlo}' value element(s) found for label '${label}' within identified container.`);
                     // Use container's text as a last resort, but avoid it for 'Input' as it might be ambiguous
                     let fallbackText = valueContainer.textContent.trim();
                     if(fallbackText && label !== 'Input') {
                         console.warn(`Using container's text content as fallback for '${label}'.`);
                         return fallbackText;
                     }
                     return null; // Return null if no reliable value found
                 }
            }

            // Handle multi-parameter inputs specifically for the "Input" label
            if (label === 'Input' && valueElements.length > 1) {
                const inputs = [];
                valueElements.forEach(el => {
                    let paramLabelText = "";
                    // Find associated parameter label (e.g., 'nums =')
                    const valueWrapper = el.closest(selectors.panelParamWrapper);
                    if (valueWrapper) {
                        const paramLabelEl = valueWrapper.querySelector(selectors.panelParamLabel);
                        if (paramLabelEl) { paramLabelText = paramLabelEl.textContent.trim(); }
                    }
                    const separator = paramLabelText ? (paramLabelText.endsWith('=') ? ' ' : ' = ') : '';
                    inputs.push(`${paramLabelText}${separator}${el.textContent.trim()}`);
                });
                 console.log(`Extracted multi-parameter input for ${label}.`);
                return inputs.join('\n'); // Join with newlines
            } else {
                 // For single inputs, Output, or Expected, just return the first element's text
                 return valueElements[0].textContent.trim();
            }
        } // --- End of getPanelText helper ---

        // Use a Set to track unique inputs processed to avoid duplicates if UI renders tabs multiple times
        const seen = new Set();
        for (let i = 0; i < caseButtons.length; i++) {
            const caseButtonText = caseButtons[i].textContent.trim();

            // Check visibility *again* right before clicking, as layout might change dynamically
            if (caseButtons[i].offsetParent !== null && typeof caseButtons[i].click === 'function') {
                 // Click the tab to make its content active
                 caseButtons[i].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                 // *** IMPORTANT PAUSE ***
                 // Wait for the UI to update after the click. 250ms is arbitrary.
                 // If tests fail here, this delay might need adjustment or a more robust waiting mechanism
                 // (like observing changes in the Input/Output panels), but that adds complexity.
                 await new Promise(r => setTimeout(r, 250));
            } else {
                 console.warn(`Skipping non-interactive/invisible case button before click: ${caseButtonText}`);
                 continue; // Skip this button
            }

            // Extract data from the now-active panel
            const input = getPanelText('Input');
            const output = getPanelText('Output');
            const expected = getPanelText('Expected');

            // Create a unique key based on the input to handle potential duplicate tab elements
            // Using || provides a fallback key if input extraction fails for some reason
            const uniqueKey = input !== null ? input : `__null_input_${i}__`;

            // Process only if input was extracted successfully AND it's a unique input
            if (input !== null && !seen.has(uniqueKey)) {
                console.log(`Processing unique case from tab ${caseButtonText} (Input Key: ${uniqueKey.substring(0, 50)}...)`);
                seen.add(uniqueKey); // Mark this input as seen
                testCases.push({
                    case: `Case ${testCases.length + 1}`, // Assign sequential case number
                    input: input,
                    output: output,
                    expected: expected,
                    // Compare output and expected for a match status
                    match: output === expected
                });
            } else if (input === null) {
                 // Log if we couldn't get input for a clicked tab
                 console.warn(`Could not extract input for a case tab (${caseButtonText}). Skipping case.`);
            } // Implicit else: Input was already seen (duplicate tab), skip silently.
        }
        console.log(`Finished processing. Collected ${testCases.length} unique test case(s).`);
    } // *** END OF NO ERROR PATH ***

    // 4. Return results
    console.log("Phase 4: Packaging results...");
    // Ensure the function directly returns the result object
    return { consoleOutput, errorDetails, testCases };
} // <--- Function definition ends here. REMOVE any execution code below this line.