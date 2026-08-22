# OmniTradeX Release Readiness

## Current posture
The terminal is a browser-based research and paper-trading prototype. Binance public market data and charting are supported; live account data and live order execution are disabled.

## Changes in this review
- Market feed now has stop/resume controls, socket generation guards, jittered reconnects, and explicit status metadata.
- Chart bootstrap requests are invalidated when symbols/timeframes change, and chart resizing uses ResizeObserver when available.
- Binance account intent is capability-scoped and emits auditable connection-intent events without accepting private keys.
- JavaScript syntax, duplicate IDs, and whitespace checks pass.

## Launch blockers
- Do not store AI or broker credentials in localStorage for a public release.
- Add server-side authenticated provider routes and encrypted secret storage before private account data.
- Add CSP/security headers and pin third-party assets before public deployment.
- Add automated browser tests for feed reconnects, stale data, chart remounts, malformed AI responses, and paper-order validation.
- Complete legal, risk, privacy, and financial-disclaimer review.

## Operating rule
Any data not sourced from a validated live feed must be labeled SIMULATED. The system must never imply that paper fills are exchange executions or that coaching is financial advice.

## Roadmap
**Now:** read-only market research, stable feed states, professional charts, paper execution, exportable journal.

**Next:** server-side auth, Neon persistence, AI proxy routes, encrypted broker connections, audit logs, rate limits.

**Later:** read-only Binance balances/positions, human-confirmed execution, step-up authentication, kill switch, security review.
