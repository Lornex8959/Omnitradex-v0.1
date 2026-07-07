# ERROR HANDLING INTEGRATION GUIDE
## OmniTradeX v0.1 — Phase 1 Patch

---

## 📋 OVERVIEW

This guide shows exactly how to integrate the new error handling system into your existing `index.html` without breaking anything.

**Files involved:**
- `error-handling-system.js` — Core error trap + API wrapper (NEW)
- `index.html` — Modified to use ErrorHandler (UPDATED)

**What gets fixed:**
1. ✅ App never crashes silently (global error trap)
2. ✅ API calls timeout after 10s (Gemini, OpenAI, Anthropic, Groq, Finnhub)
3. ✅ Failed API calls retry up to 2x with exponential backoff
4. ✅ All errors visible in AI Terminal (user sees problems)
5. ✅ Request queue prevents rate-limit issues

---

## 🔧 INTEGRATION STEPS

### **Step 1: Add ErrorHandler script to index.html HEAD**

**Location:** Just before the closing `</head>` tag (after Speed Insights, before body)

```html
<!-- Line 225-226: Keep existing Vercel scripts -->
<!-- Vercel Speed Insights -->
<script>
  window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
</script>
<script defer src="/_vercel/speed-insights/script.js"></script>

<!-- NEW: Add Error Handler System (ADD THIS) -->
<script src="error-handling-system.js"></script>
```

### **Step 2: Initialize ErrorHandler at page load**

**Location:** In your existing IIFE (the main script block), add this at the very start:

```javascript
// Line ~766-771: Your existing IIFE opening

(function () {
  'use strict';

  /* ============ INITIALIZE ERROR HANDLING (ADD THIS) ============ */
  // Must be called BEFORE any other code runs
  if (window.ErrorHandler) {
    ErrorHandler.init();
    ErrorHandler._log('SYS', 'OmniTradeX Engine booting...', 'system');
  }

  /* ============ ASSET REGISTRY ============ */
  // ... rest of your existing code ...
```

### **Step 3: Replace AI inference call**

**Current code (Line ~1025+):**
```javascript
// OLD: Direct Gemini call without error handling
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
  .then(r => r.json())
  .then(result => {
    // ... parse result ...
  });
```

**NEW: Use ErrorHandler.inferenceCall()**
```javascript
// NEW: Safe inference with timeout + retry + UI feedback
var prompt = '...'; // your prompt
var apiKey = localStorage.getItem('qc3_gemini_key');
var model = localStorage.getItem('qc3_model') || 'gemini-flash';

ErrorHandler.inferenceCall(prompt, apiKey, model)
  .then(function (result) {
    var text = result.text;
    // ... parse and display text ...
  })
  .catch(function (error) {
    // Error already logged to terminal by ErrorHandler
    // No need to handle it—user will see it in AI Terminal
  });
```

### **Step 4: Replace all direct fetch calls with ErrorHandler.apiCall()**

**For Binance WebSocket (if you add HTTP fallback):**
```javascript
// OLD
fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
  .then(r => r.json());

// NEW
ErrorHandler.apiCall('GET', 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
  timeout: 5000,
  retries: 2
})
  .then(function (data) { /* use data */ })
  .catch(function (error) { /* error logged automatically */ });
```

**For Finnhub news (if integrated):**
```javascript
// OLD
fetch('https://finnhub.io/api/v1/news?category=' + cat + '&token=' + key)
  .then(r => r.json());

// NEW
ErrorHandler.apiCall('GET', 'https://finnhub.io/api/v1/news?category=' + cat + '&token=' + key, {
  timeout: 8000,
  retries: 1
})
  .then(function (result) { /* use result */ })
  .catch(function (error) { /* logged automatically */ });
```

### **Step 5: Wallet form validation**

**Current code (Line 402-415):**
```javascript
// OLD: No validation
document.getElementById('wallet-form').addEventListener('submit', function (e) {
  e.preventDefault();
  var addr = document.getElementById('wallet-input').value;
  // ... just adds it ...
});
```

**NEW: With validation + error feedback**
```javascript
document.getElementById('wallet-form').addEventListener('submit', function (e) {
  e.preventDefault();
  var addr = document.getElementById('wallet-input').value;
  var tag = document.getElementById('wallet-tag').value;

  try {
    // Validate Ethereum address or FX node
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr) && !/^FX-/.test(addr)) {
      throw new Error('Invalid address format. Use 0x... (Ethereum) or FX-... (Forex node)');
    }

    if (!tag || tag.trim().length === 0) {
      throw new Error('Tag is required');
    }

    // Safe to add
    addWalletNode(addr, tag);
    ErrorHandler._log('WALLET', 'Added node: ' + tag, 'success');
  } catch (error) {
    ErrorHandler._log('WALLET', error.message, 'error');
  }
});
```

### **Step 6: Wrap existing functions with try-catch**

**For any critical function (like strategy synthesis):**

```javascript
// OLD
function synthesizeStrategy() {
  var symbol = state.active;
  // ... lots of logic ...
  return winner;
}

// NEW: Wrapped
function synthesizeStrategy() {
  try {
    var symbol = state.active;
    // ... lots of logic ...
    return winner;
  } catch (error) {
    ErrorHandler._log('SYNTHESIS', error.message, 'error');
    return null; // safe default
  }
}
```

---

## 🧪 TESTING THE INTEGRATION

### **Test 1: Global error trap**
```javascript
// Open browser console and run:
throw new Error('TEST ERROR');
// Expected: Error appears in AI Terminal, no crash
```

### **Test 2: API timeout**
```javascript
// Add this to test timeout (will fail after 10s)
ErrorHandler.apiCall('GET', 'https://httpstat.us/200?sleep=15000', {
  timeout: 10000
})
  .catch(function(e) { console.log('Timeout caught:', e.message); });
```

### **Test 3: Retry logic**
```javascript
// Call a non-existent endpoint (will retry 2x, then fail)
ErrorHandler.apiCall('GET', 'https://httpstat.us/500', {
  timeout: 5000,
  retries: 2
})
  .catch(function(e) { console.log('Failed after retries:', e.message); });
```

### **Test 4: Unhandled promise rejection**
```javascript
// Simulate unhandled rejection
Promise.reject('UNHANDLED TEST');
// Expected: Caught by window.unhandledrejection listener
```

---

## 📊 BEFORE vs AFTER

| Scenario | Before (❌) | After (✅) |
|----------|-----------|-----------|
| Gemini API hangs | App freezes indefinitely | Times out at 10s, retries 2x, shows error |
| Network hiccup on Binance | WebSocket silently fails | Retries with backoff, logs to terminal |
| Invalid wallet address | Added anyway, breaks logic | Validated, error shown, safe default |
| Unhandled promise rejection | Browser console error | Caught, logged to terminal, no crash |
| User closes tab then reopens | Lost state, confusing | Tab hidden/resumed events logged |
| API rate limit (429) | No retry, immediate failure | Exponential backoff, retries |

---

## 🚨 CRITICAL SECTIONS TO UPDATE

### Section 1: AI Inference Button Click Handler
**File:** `index.html` line ~1025-1080

**Current:**
```javascript
el.aiBtn.addEventListener('click', function () {
  el.loader.style.display = 'block';
  // direct fetch to Gemini...
  fetch(...).then(...);
});
```

**Update to:**
```javascript
el.aiBtn.addEventListener('click', function () {
  var prompt = /* build from state */;
  var apiKey = localStorage.getItem('qc3_gemini_key');
  var model = localStorage.getItem('qc3_model') || 'gemini-flash';

  ErrorHandler.inferenceCall(prompt, apiKey, model)
    .then(function (result) {
      // ... display result.text ...
    })
    .catch(function (error) {
      // Already logged by ErrorHandler
    });
});
```

### Section 2: WebSocket Error Handler
**File:** `index.html` line ~1200-1300

**Current:**
```javascript
ws.onclose = function () {
  // just tries to reconnect, no error logging
};

ws.onerror = function () {
  // no handler
};
```

**Update to:**
```javascript
ws.onclose = function (event) {
  ErrorHandler._log('WS', 'Connection closed: ' + event.code, event.code === 1000 ? 'success' : 'warning');
  // attempt reconnect...
};

ws.onerror = function (error) {
  ErrorHandler._log('WS', 'Error: ' + error.message, 'error');
};
```

### Section 3: Key Vault Submission
**File:** `index.html` line ~1350-1400

**Current:**
```javascript
document.getElementById('key-form').addEventListener('submit', function (e) {
  e.preventDefault();
  var key = document.getElementById('key-input').value;
  localStorage.setItem('qc3_gemini_key', key);
  // no validation
});
```

**Update to:**
```javascript
document.getElementById('key-form').addEventListener('submit', function (e) {
  e.preventDefault();
  var key = document.getElementById('key-input').value;

  if (!key || key.trim().length < 10) {
    ErrorHandler._log('KEY', 'API key too short', 'error');
    return;
  }

  localStorage.setItem('qc3_gemini_key', key);
  ErrorHandler._log('KEY', 'Key sealed in vault', 'success');
});
```

---

## 📈 MIGRATION CHECKLIST

- [ ] Add `<script src="error-handling-system.js"></script>` to HEAD
- [ ] Call `ErrorHandler.init()` at start of main IIFE
- [ ] Replace Gemini inference with `ErrorHandler.inferenceCall()`
- [ ] Replace all `fetch()` with `ErrorHandler.apiCall()`
- [ ] Add try-catch to critical functions
- [ ] Add error handlers to WebSocket events
- [ ] Validate wallet address format
- [ ] Validate API key before sealing
- [ ] Test all 4 scenarios above
- [ ] Deploy to main branch

---

## 🔍 DEBUGGING

**View error history in console:**
```javascript
ErrorHandler.getErrorHistory()
// Returns array of last 50 errors with timestamps
```

**Clear error buffer:**
```javascript
ErrorHandler.clearErrors()
```

**View current config:**
```javascript
ErrorHandler.config
// Shows timeout, retry, queue settings
```

---

## ⚠️ IMPORTANT NOTES

1. **API keys stay in browser**: This patch doesn't move keys to backend—that's Phase 2. For now, keys are still in localStorage. ErrorHandler just protects against silent failures.

2. **No breaking changes**: All existing code continues to work. ErrorHandler is additive—wraps existing calls with safety.

3. **Performance**: ErrorHandler adds ~2KB gzipped. Timeouts and retries use native `AbortController` (all modern browsers).

4. **Next step after this**: Phase 2 is backend API spec. Then Phase 3 is migration plan to move keys to server.

---

## 📞 SUPPORT

If a function doesn't fit the pattern:
1. Wrap in try-catch
2. Call `ErrorHandler._log(badge, message, type)` on error
3. Return safe default

Example:
```javascript
function risky() {
  try {
    return doSomething();
  } catch (e) {
    ErrorHandler._log('RISKY', e.message, 'error');
    return defaultValue;
  }
}
```

---

**Ready to commit?** Create a PR from `fix/error-handling-critical` → `main`

**Next phases:**
- Phase 2: Backend API spec + OAuth2 for keys
- Phase 3: Migration plan + integration tests
