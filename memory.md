# QUANTUM CORE v3 // PHASE TRACKER

Architecture lock: single-file `index.html` (HTML5 + Tailwind CDN + vanilla JS). No servers, no packages, no build stack. Credentials live only in `localStorage`.

## Phase Status

- [x] **Phase 1 — Structural Shell**: Header HUD, 3-column panel grid (Price HUD, Anomalous Stream, Wallet Tracker, Macro Scraper, Strategy Deck, AI Terminal), footer telemetry. Static placeholders, canvas anchored.
- [x] **Phase 1.5 — Layout Stabilization**: Crypto (BTC/ETH/SOL) + Forex (EUR/USD, GBP/USD, USD/JPY) tab groups; responsive min-height chart wrap; strategy deck max-height + overflow-y-auto.
- [x] **Phase 2 — WebSocket Engine & Memory Buffer**: Binance combined ticker stream with `.com`→`.us` geo failover + auto-reconnect; forex mock random-walk (2s cadence, fractions of a pip); 50-point neon quadratic waveform renderer (DPR-aware); `quantum_memory` localStorage buffer (max 5) injected into AI payloads; Gemini call with exponential backoff (1s/2s/4s); sovereign key vault (`qc3_gemini_key`).
- [x] **Phase 3 — Dynamic Panels & Typography Refactor**: All fonts unified to 'Inter', system-ui stack (headers bold, telemetry medium, tabular-nums); 10 interactive strategies with "Deployed" badge + `state.strategy`; wallet/FX-block node injector (address + tag → `qc3_wallet_nodes` in localStorage, instant render, MONITORED selection lock, deterministic simulated metrics).
- [x] **Phase 4 — Gemini Core Integration**: `triggerCoreAIInference()` (exposed on `window`) scrapes asset+spot price, deployed strategy rules matrix, and monitored node metrics; re-reads `quantum_memory` from localStorage (last 5) into system context; direct `fetch()` POST to `gemini-2.5-flash`; `#terminalLoader` toggle + safe markdown parse into `#aiOutputText`; post-analysis 1-sentence MEMORY summary committed back to buffer; exponential backoff retained; no-key heuristic fallback.

## Key localStorage Slots
- `qc3_gemini_key` — Gemini API key (sovereign, never transmitted except to Google endpoint)
- `quantum_memory` — last 5 AI decision summaries `[{t, s}]`
- `qc3_wallet_nodes` — tracked wallet/FX nodes `[{addr, tag, kind}]`

- [x] **Phase 4.5 — Audit, Bug Fixes & System Activation**:
  - FIXED: footer telemetry corrupted by index-based `querySelectorAll('footer span')` matching nested spans → explicit `#ftr-uplink` / `#ftr-keys` IDs.
  - FIXED: waveform x-axis divided by MAX_POINTS so partial buffers squashed left → scales to real buffer length.
  - FIXED: WS failover never rotated after a prior successful connect → per-connection open tracking + fail-streak endpoint rotation + reconnect backoff (2.5s→10s cap).
  - FIXED: LATENCY showed inter-message gap → true feed latency via Binance event timestamp (`Date.now() - t.E`).
  - FIXED: stale price/pair readout when switching to an asset with no data yet → placeholder state.
  - FIXED: `window.prompt()` key entry blocked in sandboxed iframes → inline Key Vault modal (input field, Seal/Purge/Cancel, Esc + backdrop close).
  - FIXED: lookbehind regex in `extractMemory` (Safari <16.4 parse crash) → compatible pattern.
  - ACTIVATED: Anomalous Stream — rolling 3σ/4σ tick-move detector (VOL-SPIKE / CASCADE), 15s per-symbol rate limit, EVT counter.
  - ACTIVATED: Macro World Scraper — rotating simulated Macro/Crypto/Forex intel board (9s cadence, GEO counter, capped 12 rows).
  - PERF: Page Visibility API pauses forex timer, macro feed, and chart repaints when tab hidden.

## Next Candidates (Phase 5)
- Latency-aware feed health diagnostics / uptime meter
- AI auto-inference scheduling (periodic cognitive sweeps)
- Order flow depth simulation panel
