'use strict';
/* OmniTradeX Engine // module: sim — load order matters, see index.html */

/* ================================================================
   PHASE 7 // MODULE 1: EXECUTION SIMULATION & RISK COMMAND
   Paper-trading ledger with 1%-risk position sizing, SL/TP fill
   engine against live ticks, and a 3% daily-loss circuit breaker.
   ================================================================ */
var LEDGER_SLOT = 'qc3_ledger';
var ledger = { equity: 10000, dayKey: '', dayStart: 10000, wins: 0, losses: 0, open: [], closed: [] };
try {
  var savedLedger = JSON.parse(localStorage.getItem(LEDGER_SLOT));
  if (savedLedger && typeof savedLedger.equity === 'number') ledger = savedLedger;
} catch (e) { /* fresh desk */ }

function saveLedger() { localStorage.setItem(LEDGER_SLOT, JSON.stringify(ledger)); }

function rollLedgerDay() {
  var today = new Date().toISOString().slice(0, 10);
  if (ledger.dayKey !== today) {
    ledger.dayKey = today;
    ledger.dayStart = ledger.equity;
    saveLedger();
  }
}

function breakerTripped() {
  rollLedgerDay();
  return ledger.equity <= ledger.dayStart * 0.97; // 3% daily loss lockout
}

function fmtUsd(v) {
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function updateSimHud() {
  var eq = document.getElementById('sim-equity');
  if (eq) eq.textContent = 'EQ ' + fmtUsd(ledger.equity);
  var pnl = ledger.equity - 10000;
  var f = document.getElementById('ftr-pnl');
  if (f) {
    f.textContent = fmtUsd(pnl);
    f.className = pnl >= 0 ? 'text-neongreen' : 'text-neonred';
  }
  var ds = document.getElementById('desk-stats');
  if (ds) ds.textContent = ledger.wins + 'W / ' + ledger.losses + 'L';
}

function openSimTrade() {
  var td = buildTradeDirective();
  if (!td || td.stand) {
    aiPrint('> SIM DESK: directive is STAND ASIDE — no trade taken. Discipline preserved.', 'text-neonamber');
    return;
  }
  if (breakerTripped()) {
    aiPrint('> CIRCUIT BREAKER: 3% daily loss limit hit. Desk locked until next session.', 'text-neonred');
    return;
  }
  for (var i = 0; i < ledger.open.length; i++) {
    if (ledger.open[i].symbol === td.symbol) {
      aiPrint('> SIM DESK: position already open on ' + ASSETS[td.symbol].label + '.', 'text-neonamber');
      return;
    }
  }
  var riskAmt = ledger.equity * 0.01; // hard 1% risk per trade
  var dist = Math.abs(td.entry - td.sl);
  if (!dist) return;
  var qty = riskAmt / dist;
  ledger.open.push({
    symbol: td.symbol, dir: td.dir === 'LONG' ? 1 : -1, entry: td.entry,
    sl: td.sl, tp: td.tp, qty: qty, strat: td.strat, t: Date.now()
  });
  saveLedger();
  updateSimHud();
  renderDesk();
  aiPrint('> SIM FILL: ' + td.dir + ' ' + ASSETS[td.symbol].label + ' @ ' + fmtPrice(td.symbol, td.entry) +
    ' | SL ' + fmtPrice(td.symbol, td.sl) + ' | TP ' + fmtPrice(td.symbol, td.tp) + ' | risk 1%', 'text-neongreen');
  arenaTape('YOU', td.dir + ' ' + ASSETS[td.symbol].label + ' @ ' + fmtPrice(td.symbol, td.entry), 'text-neongreen');
  otxAlert('fill', 'SIM FILL', td.dir + ' ' + ASSETS[td.symbol].label + ' @ ' + fmtPrice(td.symbol, td.entry)); // Phase 9 alert
}
document.getElementById('btn-sim-exec').addEventListener('click', openSimTrade);

function closeSimTrade(pos, exit, why) {
  var pnl = (exit - pos.entry) * pos.qty * pos.dir;
  ledger.equity += pnl;
  if (pnl >= 0) ledger.wins++; else ledger.losses++;
  if (window.__otxPilotXP) window.__otxPilotXP(pnl >= 0 ? 15 : 5); // discipline pays either way
  ledger.closed.push({ symbol: pos.symbol, dir: pos.dir, pnl: pnl, why: why, t: Date.now() });
  journalRecord(pos, exit, why, pnl); // Phase 9: auto post-mortem journal
  while (ledger.closed.length > 30) ledger.closed.shift();
  saveLedger();
  updateSimHud();
  renderDesk();
  var msg = why + ' ' + ASSETS[pos.symbol].label + ' -> ' + fmtUsd(pnl);
  aiPrint('> SIM ' + (pnl >= 0 ? 'WIN' : 'LOSS') + ': ' + msg, pnl >= 0 ? 'text-neongreen' : 'text-neonred');
  arenaTape('YOU', msg, pnl >= 0 ? 'text-neongreen' : 'text-neonred');
  otxAlert(pnl >= 0 ? 'win' : 'loss', 'SIM ' + (pnl >= 0 ? 'WIN' : 'LOSS'), msg); // Phase 9 alert
  if (breakerTripped()) {
    document.getElementById('arena-breaker').innerHTML = 'CIRCUIT: <span class="text-neonred">TRIPPED</span>';
    aiPrint('> CIRCUIT BREAKER TRIPPED: -3% daily. All new sim entries locked. Walk away — best trade today is no trade.', 'text-neonred');
    otxAlert('breaker', 'CIRCUIT BREAKER', 'Daily -3% limit hit. Desk locked until next session.');
  }
}

function manageSimTrades() {
  var still = [];
  ledger.open.forEach(function (pos) {
    var d = state.last[pos.symbol];
    if (!d || d.price == null) { still.push(pos); return; }
    var p = d.price;
    if (pos.dir === 1 && p <= pos.sl) return closeSimTrade(pos, pos.sl, 'STOP');
    if (pos.dir === 1 && p >= pos.tp) return closeSimTrade(pos, pos.tp, 'TARGET');
    if (pos.dir === -1 && p >= pos.sl) return closeSimTrade(pos, pos.sl, 'STOP');
    if (pos.dir === -1 && p <= pos.tp) return closeSimTrade(pos, pos.tp, 'TARGET');
    still.push(pos);
  });
  if (still.length !== ledger.open.length) {
    ledger.open = still;
    saveLedger();
  } else {
    ledger.open = still;
  }
}

function renderDesk() {
  var box = document.getElementById('desk-panel');
  if (!box) return;
  box.innerHTML = '';
  if (!ledger.open.length && !ledger.closed.length) {
    var e0 = document.createElement('p');
    e0.className = 'text-slate-500';
    e0.textContent = 'No sim positions. Fire "Execute Sim Trade" on the Terminal directive card.';
    box.appendChild(e0);
    return;
  }
  ledger.open.forEach(function (pos) {
    var d = state.last[pos.symbol];
    var upnl = d && d.price != null ? (d.price - pos.entry) * pos.qty * pos.dir : 0;
    var row = document.createElement('div');
    row.className = 'border border-gridline rounded-sm px-2.5 py-1.5 flex items-center justify-between gap-2';
    var l = document.createElement('span');
    l.className = pos.dir === 1 ? 'text-neongreen' : 'text-neonred';
    l.textContent = (pos.dir === 1 ? 'LONG ' : 'SHORT ') + ASSETS[pos.symbol].label;
    var r = document.createElement('span');
    r.className = upnl >= 0 ? 'text-neongreen' : 'text-neonred';
    r.textContent = fmtUsd(upnl);
    row.appendChild(l); row.appendChild(r);
    box.appendChild(row);
  });
  ledger.closed.slice(-5).reverse().forEach(function (c) {
    var row = document.createElement('div');
    row.className = 'flex items-center justify-between gap-2 text-slate-500';
    var l = document.createElement('span');
    l.textContent = c.why + ' ' + ASSETS[c.symbol].label;
    var r = document.createElement('span');
    r.className = c.pnl >= 0 ? 'text-neongreen' : 'text-neonred';
    r.textContent = fmtUsd(c.pnl);
    row.appendChild(l); row.appendChild(r);
    box.appendChild(row);
  });
}
