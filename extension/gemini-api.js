const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

let GEMINI_API_KEY = "";

function loadApiKey() {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get('geminiApiKey', function(data) {
        GEMINI_API_KEY = data.geminiApiKey || "";
        resolve(GEMINI_API_KEY);
      });
    } catch (error) {
      console.error("Error loading API key from storage:", error);
      resolve("");
    }
  });
}

async function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    throw new Error("API key cannot be empty");
  }
  
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || "Invalid API key");
    }
    
    if (data.models && Array.isArray(data.models)) {
      return true;
    }
    
    throw new Error("Unexpected API response format");
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error("API key validation timed out. Please check your internet connection.");
    }
    throw new Error(`API key validation failed: ${error.message}`);
  }
}

async function isApiKeyConfigured() {
  await loadApiKey();
  return GEMINI_API_KEY !== "";
}

async function getHintFromGemini(code, problemTitle, problemDescription) {
  if (!code) {
    return {
      hint: "Error: No code was provided to analyze.",
      bugs: "",
      optimization: ""
    };
  }
  
  if (!await isApiKeyConfigured()) {
    return {
      hint: "Error: Gemini API key not configured. Please set your API key in the extension settings.",
      bugs: "",
      optimization: ""
    };
  }

  // Sanitize inputs
  const sanitizedTitle = (problemTitle || "Untitled Problem").substring(0, 500);
  const sanitizedDescription = (problemDescription || "No description provided").substring(0, 1000);
  const sanitizedCode = (code || "").substring(0, 10000);
  
  const prompt = `
  You are a calm, helpful coding teacher guiding a student who is solving a LeetCode problem.
  
  Problem: ${sanitizedTitle}
  Description: ${sanitizedDescription}
  
  The student's current code:
  \`\`\`
  ${sanitizedCode}
  \`\`\`
  
  📜 FORMAT RULES:
  - DO NOT solve the problem directly.
  - Make the thing bold by encapsulating the text like *sample text* if that word/group of word is important.
  - Write your response in **three distinct sections** using headers:
    💡 Hints
    🐛 Bugs
    ⚡ Optimization Tips
  
  🧩 Hint Rules:
  - Provide 2-3 numbered hints
  - Each hint must begin with a NEW LINE using this format:
  \n• Hint 1: ...
  \n• Hint 2: ...
  \n• Hint 3: ...
  - Make hints progressive: 1st is general, 2nd is more specific, 3rd is close to solving
  - If code is fully correct, state that in Hint 1 and suggest improvements in optimization
  
  📋 Bugs:
  - Use bullet points (•)
  - Mention missing parts clearly and **why** they matter
  
  ⚙️ Optimization Tips:
  - Write only the part that can be optimized, and if it can't be optimised then say: "No optimizations needed"
  - Use code blocks (\`\`\`) if suggesting code changes
  
  Keep paragraphs short and scannable. Do not write huge blobs of text.
  `;  

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(
      `${GEMINI_API_ENDPOINT}?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            response_mime_type: "application/json",
            response_schema: {
              type: "OBJECT",
              properties: {
                hint: { type: "STRING" },
                bugs: { type: "STRING" },
                optimization: { type: "STRING" }
              }
            },
            thinkingConfig: {
              thinkingBudget: 1000
            }
          }
        }),
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      let message = `Network error: Could not connect to the Gemini API. Please check your internet connection. (Status: ${response.status})`;
      if (response.status === 400) {
        message = "API key error: The provided API key is invalid or has insufficient quota.";
      }
      throw new Error(message);
    }

    const result = await response.json();
    
    try {
      if (!result.candidates || !result.candidates.length) {
        throw new Error("Empty response from Gemini API");
      }
      
      const content = result.candidates[0].content.parts[0];
      if (content.text) {
        try {
          const parsedResponse = JSON.parse(content.text);
          return {
            hint: parsedResponse.hint || "",
            bugs: parsedResponse.bugs || "",
            optimization: parsedResponse.optimization || ""
          };
        } catch (error) {
          return { 
            hint: content.text, 
            bugs: "", 
            optimization: "" 
          };
        }
      } else if (content.inlineData && content.inlineData.json) {
        return {
          hint: content.inlineData.json.hint || "",
          bugs: content.inlineData.json.bugs || "",
          optimization: content.inlineData.json.optimization || ""
        };
      } else {
        throw new Error("Unexpected response format from Gemini API");
      }
    } catch (error) {
      throw new Error(`API response error: The Gemini API returned an unexpected response. ${error.message}`);
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error.name === 'AbortError') {
      return {
        hint: "Error: The request to Gemini API timed out. Please try again later.",
        bugs: "",
        optimization: ""
      };
    }
    return {
      hint: `Error getting hint: ${error.message}`,
      bugs: "",
      optimization: ""
    };
  }
}

async function getHintWithTestResults(code, problemTitle, problemDescription, testResultsJson) {
  console.log("Preparing advanced hint request with test results:", testResultsJson);

  if (!await isApiKeyConfigured()) {
    return {
      hint: "Error: Gemini API key not configured. Please set your API key in the extension settings.",
      bugs: "",
      optimization: ""
    };
  }

  // Sanitize inputs (same as getHintFromGemini)
  const sanitizedTitle = (problemTitle || "Untitled Problem").substring(0, 500);
  const sanitizedDescription = (problemDescription || "No description provided").substring(0, 1000);
  const sanitizedCode = (code || "").substring(0, 10000);

  let testResultsString = "Test results were not available or failed to run.";
  try {
    const fullString = JSON.stringify(testResultsJson, null, 2);
    const maxLength = 5000;
    if (fullString.length > maxLength) {
        testResultsString = fullString.substring(0, maxLength) + "\n... (results truncated)";
        console.warn(`Test results JSON string truncated to ${maxLength} characters for Gemini prompt.`);
    } else {
        testResultsString = fullString;
    }
  } catch (e) {
    console.error("Error stringifying test results:", e);
    testResultsString = "Error processing test results for prompt.";
  }

  const prompt = `
  You are a calm, helpful coding teacher guiding a student who is solving a LeetCode problem.
  The student has run their code against LeetCode's public test cases. Analyze their code *in conjunction with the test results*.

  Problem: ${sanitizedTitle}
  Description: ${sanitizedDescription}

  Student's Code:
  \`\`\`
  ${sanitizedCode}
  \`\`\`

  LeetCode PublicTest Execution Summary:
  \`\`\`json
  ${testResultsString}
  \`\`\`

  📜 FORMAT RULES:
  - DO NOT solve the problem directly.
  - Make important words/phrases bold like *sample text*.
  - Write your response in **three distinct sections** using headers:
    💡 Hints
    🐛 Bugs & Failing Tests
    ⚡ Optimization Tips

  🧩 Hint Rules:
  - Provide 2-3 numbered hints, starting each on a NEW LINE (e.g., "\\n• Hint 1: ..."). Use exactly this format including the newline.
  - Make hints progressive.
  - If the code is correct according to the public tests (e.g., "Accepted" or all cases match), focus hints on understanding *why* it's correct or potential optimizations/alternative approaches.
  - If tests fail or errors occur, tailor hints towards fixing the issues revealed by the test results.

  📋 Bugs & Failing Tests:
  - Use bullet points (•), starting each on a new line (e.g., "\\n• Issue 1: ...").
  - If the \`errorDetails\` field in the JSON is *not* null, focus on explaining that specific error and relate it to the \`lastInput\`.
  - If \`testCases\` are present and some have \`match: false\`, explain *why* the code fails for those specific inputs. Refer to the 'Input', 'Output', and 'Expected' values from the JSON.
  - Clearly state *why* parts of the code lead to the errors or failed tests.
  - If tests pass but the overall \`consoleOutput\` indicates an issue (e.g., Time Limit Exceeded, Memory Limit Exceeded, Runtime Error not caught by specific cases), address that.
  - If all tests seem to pass based on the JSON (\`match: true\` for all cases and no \`errorDetails\`), state "No bugs detected based on the provided test results."

  ⚙️ Optimization Tips:
  - Use bullet points (•), starting each on a new line (e.g., "\\n• Optimization 1: ...").
  - Suggest improvements for time or space complexity, especially if tests indicate performance issues (like Time Limit Exceeded, if captured in consoleOutput).
  - If the code is correct and reasonably efficient, suggest alternative approaches or minor stylistic improvements.
  - Use code blocks (\`\`\`) for suggested code changes.
  - If no optimizations seem necessary based on the code and test results, state: "No specific optimizations recommended based on these results."

  Keep paragraphs short and scannable. Focus on the *link* between the code and the test outcomes. Ensure hints, bugs, and optimizations points start on new lines as specified.
  `;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    console.log("Sending advanced hint request to Gemini...");

    const response = await fetch(
      `${GEMINI_API_ENDPOINT}?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            response_mime_type: "application/json",
            response_schema: {
              type: "OBJECT",
              properties: {
                hint: { type: "STRING" },
                bugs: { type: "STRING" },
                optimization: { type: "STRING" }
              },
              required: ["hint", "bugs", "optimization"]
            },
             thinkingConfig: {
                 thinkingBudget: 1200
             }
          }
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
        let errorBodyText = await response.text();
        console.error(`Gemini API Error Response (${response.status}):`, errorBodyText);
        let message = `Network error or API issue. Status: ${response.status}. Check console for details.`;
        if (response.status === 400) {
          message = "API key error: The provided API key is invalid, quota issue, or the request format is incorrect. Check console.";
        } else if (response.status === 429) {
          message = "API Error: Rate limit exceeded or quota issue. Please try again later.";
        } else if (response.status >= 500) {
            message = `Gemini API server error (${response.status}). Please try again later. Check console.`;
        }
        try {
            const errorJson = JSON.parse(errorBodyText);
            if (errorJson?.error?.message) {
                message += ` Server Message: ${errorJson.error.message}`;
            }
        } catch(e) { }

        throw new Error(message);
    }

    const result = await response.json();
    console.log("Received Gemini response (Advanced Hint):", result);

    try {
      if (!result.candidates || !result.candidates.length) {
        throw new Error("Empty response structure from Gemini API");
      }

      const content = result.candidates[0].content;
      if (!content || !content.parts || !content.parts.length) {
           throw new Error("Invalid response structure: Missing content parts");
      }

      const part = content.parts[0];

      if (part.text) {
          console.warn("Gemini returned text instead of direct JSON, attempting parse.");
          try {
              const parsedResponse = JSON.parse(part.text);
              if (parsedResponse.hint === undefined || parsedResponse.bugs === undefined || parsedResponse.optimization === undefined) {
                   console.error("Parsed text JSON missing required fields:", parsedResponse);
                   throw new Error("Parsed response missing required fields (hint, bugs, optimization).");
              }
              return {
                  hint: parsedResponse.hint || "",
                  bugs: parsedResponse.bugs || "",
                  optimization: parsedResponse.optimization || ""
              };
          } catch (parseError) {
              console.error("Failed to parse Gemini text response as JSON:", parseError, "Raw text:", part.text);
              return {
                  hint: `Error: Failed to parse API response. Raw text: ${part.text}`,
                  bugs: "",
                  optimization: ""
              };
          }
      } else {
           console.error("Unexpected response format: No 'text' field found in part.", part);
           throw new Error("Unexpected response format from Gemini API (missing text field).");
      }

    } catch (parseError) {
      console.error("Error processing Gemini response content:", parseError, "Raw result object:", result);
      throw new Error(`API response processing error: ${parseError.message}`);
    }
  } catch (error) {
    console.error("Error in getHintWithTestResults fetch/processing:", error);
    return {
      hint: `Error getting advanced hint: ${error.message}`,
      bugs: "",
      optimization: ""
    };
  }
}

async function checkApiStatus() {
  try {
    if (await isApiKeyConfigured()) {
      return { 
        status: "ok", 
        message: "Gemini API key is configured" 
      };
    } else {
      throw new Error("Gemini API key not configured");
    }
  } catch (error) {
    return {
      status: "error",
      message: error.message
    };
  }
}

function saveApiKey(apiKey) {
  return new Promise(async (resolve, reject) => {
    if (!apiKey || typeof apiKey !== 'string') {
      reject(new Error("Invalid API key format"));
      return;
    }
    
    try {
      await validateApiKey(apiKey);
      chrome.storage.sync.set({ 'geminiApiKey': apiKey }, function() {
        if (chrome.runtime.lastError) {
          reject(new Error(`Error saving API key: ${chrome.runtime.lastError.message}`));
          return;
        }
        GEMINI_API_KEY = apiKey;
        resolve(true);
      });
    } catch (error) {
      reject(error);
    }
  });
} 