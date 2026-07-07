# PHASE 1 ERROR HANDLING — TESTING GUIDE
## OmniTradeX v0.1 — Validation Checklist

---

## 🚀 QUICK START

1. **Deploy the fix/error-handling-critical branch** to see live
2. **Open DevTools** (F12 or Right-click → Inspect)
3. **Run the 5 tests below**
4. **Report results back**

---

## ✅ TEST 1: Global Error Trap (Uncaught Exception)

### What it tests:
- Does ErrorHandler catch thrown errors?
- Do they appear in AI Terminal instead of console crash?

### How to run:
```javascript
// Paste this in DevTools Console and press Enter:
throw new Error('TEST: Simulated uncaught exception');
```

### ✅ Expected Result:
- **AI Terminal** (bottom-right panel) shows:
  ```
  > [TRAP] test-script.js:1 — TEST: Simulated uncaught exception
  ```
- **Console** shows same message
- **Page doesn't freeze or crash**

### ❌ If it fails:
- Error appears in console but NOT in AI Terminal → ErrorHandler not initialized
- Page crashes/freezes → Global error trap not catching

---

## ✅ TEST 2: Unhandled Promise Rejection

### What it tests:
- Does ErrorHandler catch rejected promises?
- Are they logged without crashing?

### How to run:
```javascript
// Paste this in DevTools Console:
Promise.reject('TEST: Unhandled promise rejection');
```

### ✅ Expected Result:
- **AI Terminal** shows:
  ```
  > [PROMISE] TEST: Unhandled promise rejection
  ```
- **No console error about "Uncaught (in promise)..."**
- **Page continues working**

### ❌ If it fails:
- Console shows "Uncaught (in promise)" → unhandledrejection listener not active
- Error not in AI Terminal → ErrorHandler._log not firing

---

## ✅ TEST 3: API Timeout (10-second abort)

### What it tests:
- Does ErrorHandler timeout API calls after 10s?
- Does it show the timeout error?

### How to run:
```javascript
// Paste this in DevTools Console:
ErrorHandler.apiCall('GET', 'https://httpstat.us/200?sleep=15000', {
  timeout: 10000
})
  .catch(function(error) {
    console.log('✅ Timeout caught:', error.message);
  });
```

### ✅ Expected Result:
- After ~10 seconds:
  - **AI Terminal** shows:
    ```
    > [RETRY] Request timeout (10000ms): https://httpstat.us/...
    ```
  - **Console** logs:
    ```
    ✅ Timeout caught: Request timeout (10000ms): ...
    ```

### ❌ If it fails:
- Request hangs beyond 10s → AbortController not working
- No timeout message → Timeout logic broken

---

## ✅ TEST 4: Retry Logic (Exponential Backoff)

### What it tests:
- Does ErrorHandler retry failed requests 2x?
- Does it use exponential backoff (1s, 2s)?

### How to run:
```javascript
// Paste this in DevTools Console:
console.log('Starting retry test at', new Date().toISOString());
ErrorHandler.apiCall('GET', 'https://httpstat.us/500', {
  timeout: 5000,
  retries: 2
})
  .catch(function(error) {
    console.log('✅ Retry exhausted at', new Date().toISOString());
    console.log('Error:', error.message);
  });
```

### ✅ Expected Result:
- **AI Terminal** shows (over ~3 seconds):
  ```
  > [RETRY] Attempt 1 in 1000ms for https://httpstat.us/500
  > [RETRY] Attempt 2 in 2000ms for https://httpstat.us/500
  > [RETRY] HTTP 500: Internal Server Error
  ```
- **Console logs** start time, then end time ~3+ seconds later
- **Timing breakdown**:
  - Request 1: fails immediately (500)
  - Wait 1s
  - Request 2: fails immediately (500)
  - Wait 2s
  - Request 3: fails immediately (500)
  - Total: ~3 seconds

### ❌ If it fails:
- All 3 requests fire immediately (no backoff) → retry timer broken
- Only 1 request fired (no retry) → retries=0 overriding option
- Timing is instant (no delays) → backoff math wrong

---

## ✅ TEST 5: AI Inference with Error Handling

### What it tests:
- Does ErrorHandler.inferenceCall() work end-to-end?
- Loader appears/disappears?
- Error shows if API key missing?

### How to run:

#### **Test 5a: Missing API Key**
```javascript
// Paste this in DevTools Console:
ErrorHandler.inferenceCall('Test prompt', null, 'gemini-flash')
  .catch(function(error) {
    console.log('✅ Missing key caught:', error.message);
  });
```

**✅ Expected Result:**
- **AI Terminal** immediately shows:
  ```
  > [AI] API key not deciphered. Open Key Vault and Seal.
  ```

#### **Test 5b: With Valid API Key**
```javascript
// First, add your Gemini API key to Key Vault:
// 1. Click "Decipher Keys" button in header
// 2. Paste your Gemini API key into "GEMINI API KEY" field
// 3. Click "Seal Vault"

// Then test:
ErrorHandler.inferenceCall(
  'What is 2+2?',
  localStorage.getItem('qc3_gemini_key'),
  'gemini-flash'
)
  .then(function(result) {
    console.log('✅ Inference result:', result.text);
  })
  .catch(function(error) {
    console.log('❌ Inference failed:', error.message);
  });
```

**✅ Expected Result:**
- **Loader appears** (spinner + "INFERENCE UPLINK ACTIVE")
- **AI Terminal** shows:
  ```
  > [AI] Triggering inference on model: gemini-flash
  ```
- **After ~2-5s**, loader disappears and result appears:
  ```
  > [AI] Inference complete
  > [Response text from Gemini...]
  ```

**❌ If it fails:**
- Loader never appears → terminalLoader element not found or style issue
- Request times out after 10s → Gemini API unreachable or key invalid
- No response → Response parsing broken (check browser console for JSON error)

---

## 📊 TEST RESULTS TEMPLATE

Copy & paste this, fill in ✅/❌ for each test:

```
# PHASE 1 TEST RESULTS

## Environment
- Device: [Desktop/Mobile]
- Browser: [Chrome/Firefox/Safari/Edge]
- OS: [Windows/Mac/Linux]
- Branch: fix/error-handling-critical

## Tests
- [ ] Test 1: Global Error Trap ✅/❌
  - Result: [what you saw in AI Terminal]
  
- [ ] Test 2: Unhandled Promise Rejection ✅/❌
  - Result: [what you saw in AI Terminal]
  
- [ ] Test 3: API Timeout (10s) ✅/❌
  - Duration: [how long before timeout]
  - Result: [error message seen]
  
- [ ] Test 4: Retry Logic ✅/❌
  - Total time elapsed: [seconds]
  - Attempts shown: [1 / 2 / 3]
  - Backoff timing: [correct / incorrect]
  
- [ ] Test 5a: Missing API Key ✅/❌
  - Result: [error shown in terminal]
  
- [ ] Test 5b: With Valid API Key ✅/❌
  - Loader appeared: [Yes/No]
  - Response received: [Yes/No]
  - Response time: [seconds]

## Summary
- Total tests passed: [X/5]
- Ready for Phase 2: [Yes/No]
- Issues found: [List any problems]
```

---

## 🔍 DEBUGGING TIPS

If a test fails, try these:

### **Check 1: Is ErrorHandler initialized?**
```javascript
// Paste in console:
console.log(window.ErrorHandler);
// Should show an object with init, apiCall, inferenceCall methods
// If undefined: ErrorHandler not loaded
```

### **Check 2: View Error History**
```javascript
// Paste in console:
ErrorHandler.getErrorHistory()
// Shows last 50 errors caught by the system
```

### **Check 3: Check ErrorHandler Config**
```javascript
// Paste in console:
ErrorHandler.config
// Shows timeout/retry settings
// Should be: { AI_TIMEOUT: 10000, API_TIMEOUT: 8000, MAX_RETRIES: 2, ... }
```

### **Check 4: Verify AI Terminal Element**
```javascript
// Paste in console:
console.log(document.getElementById('ai-log'));
// Should show the HTML element
// If null: Element missing or wrong ID
```

### **Check 5: Monitor Console in Real-Time**
Keep DevTools Console open while running tests. All errors are logged there with `[TRAP]`, `[PROMISE]`, `[RETRY]`, `[AI]` badges.

---

## 📝 WHAT TO REPORT BACK

After testing, tell me:

1. **Which tests passed** (✅ all 5 = ready for Phase 2)
2. **Which tests failed** (❌ with error message from AI Terminal)
3. **Any unusual behavior** (crashes, slow responses, missing UI)
4. **Your browser & OS** (for debugging)

### **If all 5 pass:** 🎉
- We move to Phase 2 immediately
- Start building backend API spec
- Integrate database + authentication

### **If some fail:** 🔧
- I'll fix the issues on the branch
- We re-test
- Once all pass → Phase 2

---

## ⏱️ ESTIMATED TIME
- Reading this guide: 5 min
- Running all 5 tests: 10-15 min
- Reporting results: 2 min
- **Total: ~20 minutes**

**Ready? Let's go!** 🚀
