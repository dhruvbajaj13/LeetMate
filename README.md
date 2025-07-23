# LeetMate - LeetCode Helper Chrome Extension 🧩

A Chrome extension that enhances your LeetCode experience by providing personalized hints and code analysis using Google's Gemini AI.

## ✨ Features

- 🔗 Integrates seamlessly with LeetCode problem pages
- 🔍 Extracts your code directly from the LeetCode editor
- 💡 **Basic Hints:** Provides personalized hints based *only* on your current code
- 🚀 **Advanced Hints (Auto-Test):**
  - Automatically runs your code against LeetCode's test cases
  - Analyzes console output, runtime errors, and individual test case results (Input, Output, Expected, Match status)
  * Provides highly context-aware hints based on both your code *and* the actual test outcomes
- 🐞 Identifies potential bugs and edge cases, pinpointing issues related to specific failing tests (with advanced hints)
- ⚡ Suggests code optimizations for better performance or alternative approaches
- 🎨 Interactive UI overlay with collapsible sections and smooth animations
- 📋 Well-structured hints with bullet points and clear formatting
- 🔒 Direct Gemini API integration (no backend server required)
- Your API key and code/results are sent directly to Google



## 🛠️ Setup Instructions

1. **Get a Gemini API Key** 🔑
   - Visit [Google AI Studio](https://aistudio.google.com/apikey)
   - Create or use an existing Google account
   - Create a new API key specifically for this extension
   - Keep it secure!
   - You'll need this key to configure the extension

2. **Install the Extension** 📦
   - Clone or download this repository
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top-right corner
   - Click "Load unpacked" and select the directory containing the `manifest.json` file (the `extension` directory of the cloned repository)

3. **Configure the Extension** ⚙️
   - Click on the LeetCode Helper extension icon (puzzle piece) in your Chrome toolbar
   - A popup window will appear
   - Enter your Gemini API key in the input field
   - Click "Save API Key"
   - If valid, the status indicator will turn green, the status text will confirm configuration, and the extension icon itself will change to the green "enabled" state

4. **Using the Extension** 🚀
   - Navigate to any LeetCode problem page (e.g., `https://leetcode.com/problems/two-sum/`)
   - The LeetCode Helper overlay will appear in the bottom-right corner
   - Write your solution in the LeetCode code editor
   - You now have two options for getting help:
     - **Get Hint Button:** Click the "<i class="fa-solid fa-wand-magic-sparkles"></i> Get Hint" button in the overlay
     - **Hint (Auto-Test) Button:** Click the "<i class="fa-solid fa-vial-circle-check"></i> Hint (Auto-Test)" button
     - This will:
       1. Trigger LeetCode's "Run Code" functionality automatically
       2. Wait for the test results panel to appear
       3. Parse the results (console output, errors, test case details)
       4. Send your code *and* the structured test results to Gemini AI
       5. Display highly relevant hints, bug explanations tied to specific failing cases or errors, and optimization tips informed by the test outcomes
   - Expand or collapse the hint sections (💡 Hints, 🐛 Bugs & Failing Tests, ⚡ Optimization Tips) as needed

## 🔒 Privacy

- Your code, the problem title/description, and (for advanced hints) the results of running your code against LeetCode's test cases are sent directly to Google's Gemini API via HTTPS
- No data is stored on any third-party servers.
- Your API key is stored in `chrome.storage.sync`, allowing it to sync across your logged-in browsers. A non-sensitive status flag ('ok' or 'error') is kept in `chrome.storage.local` for quick UI updates on the specific machine. Both are used only for making authenticated API calls directly from your browser to Google.

## ⚠️ Limitations

- Requires a valid Gemini API key with sufficient quota
- The free tier of the Gemini API has usage limits (check Google's documentation for current limits)
- Exceeding limits may result in errors
- The extension relies on LeetCode's current HTML structure and class names for extracting information and test results
- Significant changes to LeetCode's UI could break functionality, especially the "Hint (Auto-Test)" feature
- Test case analysis (`testcase.js`) might occasionally fail to parse results correctly if LeetCode introduces unusual output formats

## 🔧 Troubleshooting

- **Extension not appearing:** Refresh the LeetCode page
- **Overlay blank/stuck:** Wait a few seconds
- **Not getting hints / API errors:**
  - Verify the API key is correct and saved in the popup
  - Check the popup status indicator
  - Check your Google AI Studio dashboard for quota usage or API errors
  - Check the browser console (F12 -> Console tab) for detailed error messages from the extension or the API
  - Ensure a stable internet connection
- **"Hint (Auto-Test)" fails:**
  - Check the console for errors originating from `testcase.js`
  - LeetCode UI might have changed, breaking the selectors in `testcase.js`
  - The "Run Code" action might be timing out if LeetCode is slow
  - The results panel format might be unexpected

## 📁 Project Structure

```
extension/                # Chrome extension
├── manifest.json         # Extension manifest
├── content.js            # Content script for LeetCode page
├── gemini-api.js         # Handles Gemini API communication
├── testcase.js           # Runs code, parses LeetCode test results
├── monaco-extractor.js   # Extracts code from Monaco editor
├── background.js         # Background script for extension state
├── popup.html            # Popup UI for configuration
├── popup.js              # Popup logic
├── overlay.css           # Styling for the overlay
└── images/               # Extension icons and images
```

## 🚀 How It Works

1. The extension injects an interactive overlay onto LeetCode problem pages
2. It extracts the problem title and description from the page
3. When you request a hint:
   - **Basic Hint:** `content.js` extracts your code (using `monaco-extractor.js`) and sends the code + problem info to `gemini-api.js`
   - **Advanced Hint:** `content.js` extracts code, then calls functions in `testcase.js` to run the code on LeetCode and parse the results
   - It sends the code, problem info, *and* the parsed test results to `gemini-api.js`
4. `gemini-api.js` constructs a detailed prompt (tailored for basic or advanced hints) and sends the request to Google's Gemini API using your stored API key
5. Gemini AI analyzes the provided information and returns a structured JSON response containing:
   - 💡 Clear, actionable hints relevant to the code (and test results, if provided)
   - 🐛 Potential bugs, edge cases, or explanations for specific test failures/errors
   - ⚡ Optimization suggestions for time/space complexity or code style
6. `content.js` receives the response and displays it in the overlay's collapsible sections, formatted for readability