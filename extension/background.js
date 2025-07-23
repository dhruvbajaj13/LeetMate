chrome.runtime.onInstalled.addListener(function(details) {
  checkApiStatus()
    .then(data => {
      if (data.status === 'ok') {
        chrome.action.setIcon({ path: { "128": "images/enabled.png" } });
      } else {
        chrome.action.setIcon({ path: { "128": "images/disabled.png" } });
      }
      chrome.action.setBadgeText({ text: '' });
    })
    .catch(error => {
      console.error('Error checking API status on install:', error);
      chrome.action.setIcon({ path: { "128": "images/disabled.png" } });
      chrome.action.setBadgeText({ text: '' });
    });
});

chrome.runtime.onStartup.addListener(function() {
  checkApiStatus()
    .then(data => {
      if (data.status === 'ok') {
        chrome.action.setIcon({ path: { "128": "images/enabled.png" } });
      } else {
        chrome.action.setIcon({ path: { "128": "images/disabled.png" } });
      }
      chrome.action.setBadgeText({ text: '' });
    })
    .catch(error => {
      console.error('Error checking API status on startup:', error);
      chrome.action.setIcon({ path: { "128": "images/disabled.png" } });
      chrome.action.setBadgeText({ text: '' });
    });
});

function checkApiStatus() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.get('geminiApiKey', function(data) {
        const apiKey = data.geminiApiKey || "";
        if (apiKey && apiKey.trim() !== '') {
          resolve({ status: "ok", message: "Gemini API key is configured" });
        } else {
          resolve({ status: "error", message: "Gemini API key not configured" });
        }
      });
    } catch (error) {
      reject(error);
    }
  });
} 