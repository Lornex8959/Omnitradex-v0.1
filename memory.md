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

- [x] **Phase 5 — Autonomous Intelligence Layer** (adapted to single-file JS per architecture lock; backend/HF/CI directives rejected):
  - MODULE 1: Multi-timeframe filter — fast(10t)/mid(25t)/slow(50t) drift-vs-noise z-score trends with cross-period ALIGNMENT GATE (LONG-OK / SHORT-OK / BLOCKED / WAIT) rendered as an MTF strip in the Price HUD and enforced as a HARD RULE in the AI system instruction.
  - MODULE 2: Dynamic trailing SL — volatility-scaled trail (12x mean abs tick move, clamped 0.5%-4%) ratcheted from peak price per symbol; label + payload show live trail %.
  - MODULE 3: Bot/whale behavior tracking — per-node state machine (DORMANT / ACCUMULATING / DISTRIBUTING / TRAP-DETECTED, 20s cadence); TRAP on the monitored node raises `state.execPaused`, logs to Anomalous Stream, and forces AI stand-aside.
  - MODULE 4: Strategy synthesis — scores all 10 vectors against live conditions (trend, chop, stretch, delta heat, asset class) every 15s; AI-FIT badge on best-fit card; recommendation included in payload.
  - MODULE 5: Hardening — global error + unhandledrejection traps (terminal never crashes), 30s feed-stall watchdog that recycles the socket, 10s inference rate-limit cooldown (respectful throttling, no bypassing).

- [x] **Phase 6 — Self-Evolving Global Intelligence** (VERIFIED LIVE):
  - MODULE 1: Sovereign multi-provider Key Vault — model registry (Gemini 2.5 Flash/Pro, GPT-4o, Claude Sonnet, Groq Llama-3.3) with per-provider adapters (`providerRequest()`) resolving endpoint + auth shape; keys stored per-provider in localStorage, transmitted ONLY to each provider's own official endpoint; exponential backoff retained.
  - MODULE 2: Adaptive Learning Engine — `qc3_learning` slot ({weights, samples, wins, insights}); signal registration hooked into `runSynthesis()`; outcome scoring evolves strategy weights over time.
  - MODULE 3: Elite Trade Directive Engine — structured directive card (entry / SL / target / confidence) in the AI Terminal, gate-aware.
  - MODULE 4: Global Intel View — dedicated nav view (GLOBAL INTEL button) with Impact Radar sentiment chips (Equities/Crypto/Forex/Commodities), category filters (ALL/MACRO/EQUITIES/CRYPTO/FOREX/GEOPOLITICS), sentiment-tagged headline cards with affected tickers + AI Impact Forecast triggers; simulated wire feed with optional Finnhub key for live headlines.
  - FOOTER: learning telemetry HUD (`#ftr-learn`, "N SIG // X% EDGE") wired to the learning slot.
  - VERIFIED: view toggling terminal↔intel clean, price stream live, learning HUD live, zero runtime errors.

- [x] **Phase 7 — Execution Sim + AI Arena + Mentor** (VERIFIED LIVE):
  - PAIRS EXPANDED: 12 assets — crypto BTC/ETH/SOL/XRP/BNB/DOGE (live Binance WS, all 6 in stream string) + forex EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF, USD/CAD (mock walk engine).
  - MODULE 1: Execution Simulation & Risk Command — `qc3_ledger` paper desk ($10k start), "Execute Sim Trade" button on directive card (refuses STAND ASIDE gates — verified), hard 1%-risk position sizing (qty = risk/SL-distance), 4s SL/TP fill engine vs live ticks, 3% daily-loss circuit breaker with lockout, footer SIM P/L HUD (`#ftr-pnl`) + `#sim-equity`.
  - MODULE 2: AI Arena (Quantum Colosseum view, `nav-arena`) — 6 AI personas (GPT-TITAN momentum, CLAUDE-SAGE structure, GEMINI-NOVA mean-rev, LLAMA-VIPER scalper, GROK-MAVERICK contrarian, DEEPSEEK-ORACLE trend) each trading live buffers via `botSignal()` heuristics every 12s with SL/TP/3-min time-stop; live leaderboard includes YOU row from ledger; Arena Tape fill feed; season reset button; persisted in `qc3_arena`.
  - MODULE 3: AI Mentor (view `nav-mentor`) — chat partner with live context injection (`mentorContext()`: active asset, MTF gate, ledger stats, learned edge, arena leader, intel headlines); uses active provider via `callModel()` when key sealed, else `mentorHeuristic()` local coach (revenge-trading / sizing / market / performance-review rules); quick-prompt chips; history persisted in `qc3_mentor` (12 msgs).
  - VIEW SWITCHER: generalized 4-view `VIEWS` map (terminal/intel/arena/mentor) with per-accent nav states.
  - VERIFIED: 12 tabs, all 4 views toggle clean, arena bots taking live trades, mentor discipline reply works, sim exec correctly refused on blocked gate, zero SYS-TRAPs.

## Additional localStorage Slots
- `qc3_learning` — adaptive engine state `{weights, samples, wins, insights}`
- `qc3_ledger` — sim desk `{equity, dayKey, dayStart, wins, losses, open[], closed[]}`
- `qc3_arena` — arena `{season, stats:{botId:{equity,wins,losses}}}`
- `qc3_mentor` — mentor chat history (last 12 messages)

- [x] **Phase 8 — OmniTradeX Rebrand + Pilot Profiles + Dual Theme** (VERIFIED LIVE):
  - REBRAND: product renamed **OMNITRADEX ENGINE** (title, meta description, header identity, footer CORE tag, mentor system prompt, boot line). "Quantum Core v3" retained as the engine codename subtitle.
  - MODULE 1: Dual theme engine — Night Ops (dark, default) / Solar Deck (light) via `html.light` CSS override layer (~30 scoped rules: panels, text ramp, neon→deep accent remap, scrollbars, modal backdrop); waveform screen intentionally stays a dark neon display in light mode; toggle button in header (moon/sun icon), persisted in `otx_theme`, smooth 0.35s transitions.
  - MODULE 2: Pilot Profiles — sovereign local accounts (NO backend, per architecture lock): salted SHA-256 passphrase hashing via WebCrypto (djb2 fallback for non-secure contexts); register/login/logout modal; per-pilot progress snapshots (`otx_profile_<name>`) covering ledger/learning/arena/mentor/memory/wallet-node slots; login restores snapshot + full reload re-ignition; logout saves + resets guest desk; 60s autosave.
  - MODULE 3: XP & rank ladder — XP hooks on closed sim trades (+15 win / +5 loss — discipline pays either way) and mentor questions (+2); level = floor(sqrt(xp/25))+1; ranks CADET→OPERATOR→SPECIALIST→VETERAN→COMMANDER→QUANTUM ELITE; header chip (NAME // LVn) + footer PILOT telemetry.
  - FIX: light-mode invisible text on `text-slate-100/200/white` elements (deployed strategy card title) → mapped to near-black.
  - VERIFIED: full cycle signup→XP(30, OPERATOR)→logout(clean guest)→login(restored) + wrong-passphrase rejection + both themes screenshot-checked, zero runtime errors.

## Phase 8 localStorage Slots
- `otx_theme` — 'dark' | 'light'
- `otx_pilots` — `{name: {salt, hash, created, xp}}`
- `otx_session` — active pilot callsign
- `otx_profile_<name>` — per-pilot snapshot of all progress slots

## Professional Upgrade Pass — 2026-08
- MODULARIZED: runtime split across `js/` modules with explicit classic-script load order; `index.html` is now the composition shell.
- HARDENED: all modules pass standalone JavaScript syntax compilation; duplicate DOM IDs checked; dynamic user/API text uses `textContent` or the safe markdown renderer.
- UX: institutional terminal density pass applied — flat graphite surfaces, hairline borders, restrained accents, tabular numerics, responsive horizontal navigation, explicit loading/disabled states.
- MODEL POLICY: provider IDs remain configurable in the local vault; do not silently claim AI output is market truth. The UI must label simulated heuristics, paper execution, and educational-only results.
- KNOWN LIMITATION: localStorage credentials and browser-direct provider calls are appropriate for a personal prototype, not a production multi-user trading service. Neon is reserved for the planned server-side persistence/auth migration.

## Phase 10 — Realtime Market Workstation
- [x] Binance public combined WebSocket adapter with normalized ticker events, endpoint fallback, exponential reconnect, heartbeat/stale-feed detection, and explicit LIVE/STALE provenance.
- [x] TradingView Lightweight Charts primary synchronized candlestick/volume surface with timeframe controls.
- [x] Optional official TradingView widget for external deep analysis; isolated from private app state.
- [x] Binance account connection boundary scaffold: no private keys requested or stored in browser; live execution remains disabled until a server route is provisioned.
- [x] Bounded Research Coach: evidence summary, regime/invalidation/risk/lesson output, and local adaptive coaching ledger; no autonomous execution authority.
- [x] Modular files added: `js/market-data.js`, `js/charts.js`, `js/tradingview.js`, `js/binance-account.js`, `js/agent.js`.
- [x] Verification: all JavaScript modules compile; DOM IDs are unique. Browser preview was unavailable during final pass.

## Next Candidates (Phase 11)
- Replace tick-tape replay with Binance klines REST ingestion, candle aggregation, fees and slippage model.
- Provision Next.js + Neon server routes for encrypted broker OAuth/credential custody, journal sync, and audit events.
- Add deterministic risk controls: max notional, spread/slippage assumptions, daily journal export, immutable audit events.
- Build agent evaluation harness: replay historical candles, score coaching accuracy, and require human approval for every paper action.
- Social layer: shareable read-only desk card with no credentials or private data.
