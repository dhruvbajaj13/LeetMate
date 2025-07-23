(() => {
    try {
      const models = window.monaco?.editor?.getModels();
      if (models && models.length > 0) {
        const code = models[0].getValue();
        window.postMessage({ type: 'LEETCODE_CODE_EXTRACTED', code }, '*');
      } else {
        window.postMessage({ type: 'LEETCODE_CODE_EXTRACTED', code: null }, '*');
      }
    } catch (err) {
      window.postMessage({ type: 'LEETCODE_CODE_EXTRACTED', code: null, error: err.message }, '*');
    }
  })();