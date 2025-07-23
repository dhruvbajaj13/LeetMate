document.addEventListener('DOMContentLoaded', initializeExtension);
window.addEventListener('load', initializeExtension);

setTimeout(initializeExtension, 3000);

let overlay = null;
let problemTitle = "N/A";
let problemDescription = "N/A";
let hasInitialized = false;

function initializeExtension() {
  if (hasInitialized || document.querySelector('#leetcode-helper-overlay')) {
    return;
  }
  
  hasInitialized = true;
  
  try {
    extractProblemInfo();
    createOverlay();
    document.getElementById('leetcode-helper-get-hint').addEventListener('click', getHint);
    document.getElementById('leetcode-helper-get-hint-advanced').addEventListener('click', getHintAdvanced);
    document.getElementById('leetcode-helper-toggle').addEventListener('click', toggleOverlay);
  } catch (error) {
    console.error("Error during extension initialization:", error);
    displayErrorMessage("Error: LeetCode's page structure has changed. The extension may not work correctly.");
  }
}

function extractProblemInfo() {
  try {
    const titleElement = document.querySelector('div.text-title-large a[href^="/problems/"]');
    if (titleElement) {
      problemTitle = titleElement.textContent.trim();
    } else {
      const url = window.location.href;
      const problemMatch = url.match(/\/problems\/([^\/]+)/);
      if (problemMatch && problemMatch[1]) {
        const rawName = problemMatch[1];
        problemTitle = rawName
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      console.log("URL Problem Title", problemTitle);
    }

    const descriptionElement = document.querySelector('div.elfjS[data-track-load="description_content"]');
    if (descriptionElement) {
      problemDescription = descriptionElement.textContent.trim();
    }
  } catch (error) {
    console.error("Error extracting problem information:", error);
    displayErrorMessage("Error: LeetCode's page structure has changed. The extension may not work correctly.");
  }
}

function createOverlay() {
  try {
    overlay = document.createElement('div');
  } catch (error) {
    console.error("Error creating overlay element:", error);
    return;
  }

  overlay.id = 'leetcode-helper-overlay';
  overlay.className = 'leetcode-helper-overlay';
  
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const faLink = document.createElement('link');
    faLink.rel = 'stylesheet';
    faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(faLink);
  } else {
    const statusIcon = document.getElementById('status-icon');
    if (statusIcon) {
        statusIcon.classList.add('connected');
    }
}
  
  overlay.innerHTML = `
    <div class="leetcode-helper-header">
      <div style="display: flex; align-items: center;">
        <i class="fa-solid fa-puzzle-piece" style="margin-right: 8px;"></i>
        <h3>LeetCode Helper</h3>
      </div>
      <button id="leetcode-helper-toggle" class="leetcode-helper-button"><i class="fa-solid fa-minus"></i></button>
    </div>
    <div class="leetcode-helper-content" id="leetcode-helper-content">
      <p><i class="fa-solid fa-lightbulb" style="color: #f1c40f; margin-right: 5px;"></i> Need help with your solution? Click a button below!</p>
      <div style="display: flex; gap: 10px; margin-top: 15px;">
        <button id="leetcode-helper-get-hint" class="leetcode-helper-button leetcode-helper-primary" style="flex: 1;">
          <i class="fa-solid fa-wand-magic-sparkles"></i> Get Hint
        </button>
        <button id="leetcode-helper-get-hint-advanced" class="leetcode-helper-button leetcode-helper-primary" style="flex: 1;">
          <i class="fa-solid fa-vial-circle-check"></i> Hint (Auto-Test)
        </button>
      </div>
      <div id="leetcode-helper-hint-container" class="leetcode-helper-hint-container" style="display: none;">
        <div id="leetcode-helper-hint"></div>
        <div id="leetcode-helper-bugs"></div>
        <div id="leetcode-helper-optimization"></div>
      </div>
      <div id="leetcode-helper-loading" class="leetcode-helper-loading" style="display: none;">
        <p>Getting your hint...</p>
        <div style="margin-top: 15px;"></div>
        <div class="leetcode-helper-spinner"></div>
      </div>
    </div>
  `;

  try {
    document.body.appendChild(overlay);
  } catch (error) {
    console.error("Error appending overlay to the document:", error);
  }
}

function toggleOverlay() {
  try {
    const content = document.getElementById('leetcode-helper-content');
    const toggle = document.getElementById('leetcode-helper-toggle');
    
    if (content.classList.contains('collapsed')) {
      content.classList.remove('collapsed');
      setTimeout(() => {
        toggle.innerHTML = '<i class="fa-solid fa-minus"></i>';
      }, 200);
    } else {
      content.classList.add('collapsed');
      setTimeout(() => {
        toggle.innerHTML = '<i class="fa-solid fa-plus"></i>';
      }, 200);
    }
  } catch (error) {
    console.error("Error toggling overlay:", error);
  }
}

function injectMonacoExtractor() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('monaco-extractor.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error("Error injecting Monaco extractor:", error);
  }
}

function getLeetCodeCode() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      console.warn("Monaco code extraction timed out. Falling back to DOM extraction.");
      resolve(extractFromDOM());
    }, 5000);
    
    const handleMessage = (event) => {
      if (event.source !== window) return;
      if (event.data?.type === 'LEETCODE_CODE_EXTRACTED') {
        clearTimeout(timeout);
        window.removeEventListener('message', handleMessage);
        if (event.data.code !== null) {
          console.log("Extracted code from Monaco:", event.data.code);
          resolve(event.data.code);
        } else {
          console.warn("Falling back to DOM-based extraction.");
          resolve(extractFromDOM());
        }
      }
    };
    window.addEventListener('message', handleMessage);
    injectMonacoExtractor();
  });
}

function extractFromDOM() {
  try {
    const codeContainer = document.querySelector('.view-lines.monaco-mouse-cursor-text');
    if (codeContainer) {
      try {
        const codeLines = codeContainer.querySelectorAll('.view-line');
        let code = '';
        codeLines.forEach(line => code += line.textContent + '\n');
        console.log("Extracted code from DOM (fallback):", code);
        return code;
      } catch (error) {
        console.error("Error extracting code lines from container:", error);
        return null;
      }
    }
    console.error("Could not extract code via DOM fallback.");
    return null;
  } catch (error) {
    console.error("Error during DOM-based code extraction:", error);
    return null;
  }
}

async function getHint() {
  try {
    document.getElementById('leetcode-helper-loading').style.display = 'flex';
    document.getElementById('leetcode-helper-hint-container').style.display = 'none';
    
    document.querySelectorAll('.leetcode-helper-content-section').forEach(section => {
      section.classList.remove('collapsed');
    });
  } catch (error) {
    console.error("Error updating overlay display:", error);
    displayErrorMessage("Error: LeetCode's page structure has changed. The extension may not work correctly.");
    return;
  }

  try {
    const code = await getLeetCodeCode();
    if (code) {
      try {
        const data = await getHintFromGemini(code, problemTitle, problemDescription);
        
        try {
          document.getElementById('leetcode-helper-loading').style.display = 'none';
          document.getElementById('leetcode-helper-hint-container').style.display = 'block';
          updateHintContainer(data);
        } catch (e) {
          console.error("Error updating hint container", e);
          document.getElementById('leetcode-helper-hint').innerHTML = "<h4>Error:</h4><p>Error updating the hint display. The extension may not work correctly.</p>";
          document.getElementById('leetcode-helper-hint-container').style.display = 'block';
        }
      } catch (error) {
        console.error("Error getting hint:", error);
        try {
          document.getElementById('leetcode-helper-loading').style.display = 'none';
          document.getElementById('leetcode-helper-hint').innerHTML = `<h4>Error:</h4><p>${error.message || "Could not get hint. Please check the Gemini API key in extension settings."}</p>`;
          document.getElementById('leetcode-helper-hint-container').style.display = 'block';
        } catch (domError) {
          console.error("Error updating DOM after hint error:", domError);
        }
      }
    } else {
      try {
        document.getElementById('leetcode-helper-loading').style.display = 'none';
        document.getElementById('leetcode-helper-hint').innerHTML = "<h4>Error:</h4><p>Could not extract code from the editor.</p>";
        document.getElementById('leetcode-helper-hint-container').style.display = 'block';
      } catch (domError) {
        console.error("Error updating DOM after code extraction failure:", domError);
      }
    }
  } catch (error) {
    console.error("Unexpected error in getHint:", error);
    displayErrorMessage("An unexpected error occurred. Please try again.");
  }
}

async function getHintAdvanced() {
  const loadingElement = document.getElementById('leetcode-helper-loading');
  const hintContainer = document.getElementById('leetcode-helper-hint-container');
  const hintElement = document.getElementById('leetcode-helper-hint');

  try {
    loadingElement.innerHTML = '<p>Getting your hint & running tests...</p><div style="margin-top: 15px;"></div><div class="leetcode-helper-spinner"></div>';
    loadingElement.style.display = 'flex';
    hintContainer.style.display = 'none';
    hintElement.innerHTML = '';
    document.getElementById('leetcode-helper-bugs').innerHTML = '';
    document.getElementById('leetcode-helper-optimization').innerHTML = '';


    const code = await getLeetCodeCode();
    if (!code) {
      displayErrorMessage("Could not extract code from the editor.");
      return;
    }

    let testResults = null;
    try {
      console.log("Running LeetCode tests via testing.js...");
      loadingElement.querySelector('p').textContent = 'Running tests...';
      testResults = await getLeetCodeTestSummaryJSON();
      console.log("Test Results Received:", testResults);
      loadingElement.querySelector('p').textContent = 'Tests finished. Getting hint...';
    } catch (testError) {
      console.error("Error running tests:", testError);
      testResults = {
          consoleOutput: "Test Execution Error",
          errorDetails: { message: `Failed to execute LeetCode tests: ${testError.message}`, lastInput: null },
          testCases: []
      };
      displayErrorMessage(`Warning: Could not automatically run tests (${testError.message}). Hints will be based on code only.`);
      loadingElement.querySelector('p').textContent = 'Getting hint...';
    }

    if (typeof getHintWithTestResults !== 'function') {
         throw new Error("getHintWithTestResults function not found. Check script loading order.");
    }
    const data = await getHintWithTestResults(code, problemTitle, problemDescription, testResults);

    updateHintContainer(data);
    hintContainer.style.display = 'block';

  } catch (error) {
    console.error("Error in getHintAdvanced:", error);
    displayErrorMessage(`Advanced Hint Error: ${error.message || "An unexpected error occurred."}`);
  } finally {
    loadingElement.style.display = 'none';
  }
}

function displayErrorMessage(message) {
    try {
        const hintElement = document.getElementById('leetcode-helper-hint');
        if (hintElement) {
            hintElement.innerHTML = `<h4>Error:</h4><p>${message}</p>`;
        }
        const hintContainer = document.getElementById('leetcode-helper-hint-container');
        if (hintContainer) {
            hintContainer.style.display = 'block';
        }
        
        const loadingElement = document.getElementById('leetcode-helper-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    } catch (error) {
        console.error("Error displaying error message:", error);
    }
}

function updateHintContainer(data) {
    try {
        const hintElement = document.getElementById('leetcode-helper-hint');
        const bugsElement = document.getElementById('leetcode-helper-bugs');
        const optimizationElement = document.getElementById('leetcode-helper-optimization');
        
        hintElement.innerHTML = '';
        bugsElement.innerHTML = '';
        optimizationElement.innerHTML = '';
        
        if (data.hint) {
          hintElement.innerHTML = `
            <div class="leetcode-helper-section-header" data-target="leetcode-helper-hint-content">
              <h4>💡 Hint:</h4>
              <i class="fa-solid fa-chevron-down"></i>
            </div>
            <div id="leetcode-helper-hint-content" class="leetcode-helper-content-section">
              ${formatTextWithCodeBlocks(data.hint)}
            </div>
          `;
        }
        
        if (data.bugs) {
          bugsElement.innerHTML = `
            <div class="leetcode-helper-section-header" data-target="leetcode-helper-bugs-content">
              <h4>🐞 Bugs & Edge Cases:</h4>
              <i class="fa-solid fa-chevron-down"></i>
            </div>
            <div id="leetcode-helper-bugs-content" class="leetcode-helper-content-section">
              ${formatTextWithCodeBlocks(data.bugs)}
            </div>
          `;
        }
        
        if (data.optimization) {
          optimizationElement.innerHTML = `
            <div class="leetcode-helper-section-header" data-target="leetcode-helper-optimization-content">
              <h4>⚡ Optimization Tips:</h4>
              <i class="fa-solid fa-chevron-down"></i>
            </div>
            <div id="leetcode-helper-optimization-content" class="leetcode-helper-content-section">
              ${formatTextWithCodeBlocks(data.optimization)}
            </div>
          `;
        }
        
        document.querySelectorAll('.leetcode-helper-section-header').forEach(header => {
          header.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const section = document.getElementById(targetId);
            const icon = this.querySelector('i');
            
            if (section.classList.contains('collapsed')) {
              section.classList.remove('collapsed');
              icon.classList.remove('fa-chevron-right');
              icon.classList.add('fa-chevron-down');
            } else {
              section.classList.add('collapsed');
              setTimeout(() => {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-right');
              }, 150);
            }
          });
        });
    } catch (error) {
        console.error("Error updating hint container elements:", error);
        throw error;
    }
}

function formatTextWithCodeBlocks(text) {
  if (!text) {
    return '';
  }
  
  text = text.replace(/•\s+/g, '<span class="leetcode-helper-bullet">•</span> ');
  
  text = text.replace(/\n\n/g, '</p><p>');
  
  text = text.replace(/(Hint \d+:)/g, '<strong>$1</strong>');
  
  text = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  
  text = text.replace(/```([\s\S]+?)```/g, function(match, code) {
    const langMatch = code.match(/^(\w+)\s+([\s\S]+)$/);
    if (langMatch) {
      return `<pre class="leetcode-helper-code-block" data-language="${langMatch[1]}"><code>${langMatch[2]}</code></pre>`;
    }
    return `<pre class="leetcode-helper-code-block"><code>${code}</code></pre>`;
  });
  
  text = text.replace(/``([\s\S]+?)``/g, function(match, code) {
    const langMatch = code.match(/^(\w+)\s+([\s\S]+)$/);
    if (langMatch) {
      return `<pre class="leetcode-helper-code-block" data-language="${langMatch[1]}"><code>${langMatch[2]}</code></pre>`;
    }
    return `<pre class="leetcode-helper-code-block"><code>${code}</code></pre>`;
  });
  
  text = text.replace(/`([^`]+)`/g, '<code class="leetcode-helper-code">$1</code>');
  
  if (!text.startsWith('<p>')) {
    text = '<p>' + text;
  }
  if (!text.endsWith('</p>')) {
    text = text + '</p>';
  }
  
  return text;
} 