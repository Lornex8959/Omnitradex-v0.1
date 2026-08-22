'use strict';
/* OmniTradeX Engine // module: boot — load order matters, see index.html */

/* ================================================================
   PHASE 5 // MODULE 5: SYSTEM HARDENING
   Global error trap, feed stall watchdog, self-healing timers.
   ================================================================ */
// global error trap: the terminal must never crash silently
window.addEventListener('error', function (e) {
  try {
    aiPrint('> SYS-TRAP: ' + (e.message || 'unknown fault') + ' — terminal integrity preserved.', 'text-neonred');
  } catch (ignore) { /* aiLog itself unavailable: nothing else to do */ }
});
window.addEventListener('unhandledrejection', function (e) {
  try {
    aiPrint('> SYS-TRAP (async): ' + (e.reason && e.reason.message ? e.reason.message : 'rejected promise') + '.', 'text-neonred');
  } catch (ignore) { /* ignore */ }
  e.preventDefault();
});

// feed stall watchdog: force-recycle the socket if LIVE but silent > 30s
setInterval(function () {
  if (document.hidden) return;
  if (el.hudFeed.textContent === 'LIVE' && state.lastTickAt && Date.now() - state.lastTickAt > 30000) {
    setFeed('STALLED', 'text-neonred');
    aiPrint('> Watchdog: feed stall detected. Recycling uplink...', 'text-neonamber');
    try { if (state.ws) state.ws.close(); } catch (e) { /* onclose handles reconnect */ }
  }
}, 10000);

// behavior state machine + strategy synthesis + Phase 6 cognition loops
setInterval(function () { if (!document.hidden) rollNodeStates(); }, 20000);
setInterval(function () { if (!document.hidden) runSynthesis(true); }, 15000);
setInterval(function () { if (!document.hidden) { learnEvaluate(); renderTradeDirective(); } }, 10000);
// Phase 7: sim fill engine (fast) + arena bot brains (slower cadence)
setInterval(function () { if (!document.hidden) { manageSimTrades(); if (!VIEWS.arena.el.classList.contains('hidden')) renderDesk(); } }, 4000);
setInterval(function () { if (!document.hidden) arenaDecide(); }, 12000);

/* ---------------- IGNITION ---------------- */
seedForex();
startForexEngine();
connectBinance();
rollNodeStates();
setLoader(false);
pushMacroUpdate(); // first intel sweep immediately
setTimeout(function () { runSynthesis(true); renderTradeDirective(); }, 4000); // first synthesis once buffers warm
updateLearnHud();
rollLedgerDay();
updateSimHud();
renderDesk();
renderArena();
aiPrint('> OMNITRADEX ENGINE online. Phase 9: replay, consensus voting, auto journal + alerts armed. Fly with discipline.', 'text-neongreen');
renderJournal();
if (journal.length) aiPrint('> Journal restored: ' + journal.length + ' post-mortem entries from local sandbox.', 'text-slate-500');
if (learning.samples) {
  aiPrint('> Learning engine restored: ' + learning.samples + ' evaluated signals, ' + (learnWinRate() * 100).toFixed(0) + '% validated edge.', 'text-slate-500');
}
if (quantum_memory.length) {
  aiPrint('> Restored ' + quantum_memory.length + ' cognitive memories from local sandbox.', 'text-slate-500');
}
setFooterUplink('ACTIVE');
if (anyModelKey()) setFooterKeys(true);
