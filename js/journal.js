'use strict';
/* OmniTradeX Engine // module: journal — load order matters, see index.html */

/* ================================================================
   PHASE 9 // MODULE 2: AUTO TRADE JOURNAL — POST-MORTEM LOG
   Every closed sim trade is journaled with R-multiple, hold time
   and an automatic post-mortem note. Profile-bound via localStorage.
   ================================================================ */
var JOURNAL_SLOT = 'otx_journal';
var journal = [];
try { journal = JSON.parse(localStorage.getItem(JOURNAL_SLOT)) || []; } catch (e) { journal = []; }
function saveJournal() { localStorage.setItem(JOURNAL_SLOT, JSON.stringify(journal)); }

function fmtHold(ms) {
  var s = Math.round(ms / 1000);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
}

function postMortem(r, why, holdMs, strat) {
  var s = strat ? ' Vector: ' + strat + '.' : '';
  if (why === 'TARGET') {
    if (holdMs < 120000) return 'Clean execution — target hit fast. Momentum read was right. Do not oversize the next one out of euphoria.' + s;
    return 'Plan executed to completion: entry, hold, target. This is the trade to replicate — process over outcome.' + s;
  }
  if (holdMs < 120000) return 'Stopped out within minutes. Entry likely chased momentum instead of waiting for structure. Review the MTF gate state at entry.' + s;
  if (r > -1.05 && r < -0.95) return 'Stop respected — loss capped at exactly 1R. That is discipline working, not failure. Log the setup and move on.' + s;
  return 'Stop hit after an extended hold. The thesis degraded slowly — consider tightening trail rules when MTF alignment flips.' + s;
}

function journalRecord(pos, exit, why, pnl) {
  var riskAmt = pos.qty * Math.abs(pos.entry - pos.sl) || 1;
  var r = pnl / riskAmt;
  var holdMs = Date.now() - pos.t;
  journal.push({
    symbol: pos.symbol, dir: pos.dir, entry: pos.entry, exit: exit,
    pnl: pnl, r: r, why: why, strat: pos.strat || '', hold: holdMs,
    t: Date.now(), note: postMortem(r, why, holdMs, pos.strat)
  });
  while (journal.length > 200) journal.shift();
  saveJournal();
  renderJournal();
}

function journalStatCell(label, value, cls) {
  var d = document.createElement('div');
  d.className = 'border border-gridline rounded-sm px-3 py-2';
  var p1 = document.createElement('p');
  p1.className = 'text-slate-600 uppercase text-[9px] tracking-widest';
  p1.textContent = label;
  var p2 = document.createElement('p');
  p2.className = 'font-orbitron text-sm ' + cls;
  p2.textContent = value;
  d.appendChild(p1); d.appendChild(p2);
  return d;
}

function renderJournal() {
  var stats = document.getElementById('journal-stats');
  var list = document.getElementById('journal-list');
  if (!stats || !list) return;
  stats.innerHTML = '';
  list.innerHTML = '';

  if (!journal.length) {
    var empty = document.createElement('p');
    empty.className = 'text-slate-500';
    empty.textContent = 'No closed sim trades yet. Every trade the desk closes is auto-journaled here with a post-mortem.';
    list.appendChild(empty);
    stats.appendChild(journalStatCell('Trades', '0', 'text-slate-400'));
    return;
  }

  var wins = 0, grossW = 0, grossL = 0, sumR = 0, best = journal[0], worst = journal[0];
  journal.forEach(function (j) {
    if (j.pnl >= 0) { wins++; grossW += j.pnl; } else { grossL += Math.abs(j.pnl); }
    sumR += j.r;
    if (j.pnl > best.pnl) best = j;
    if (j.pnl < worst.pnl) worst = j;
  });
  var wr = (wins / journal.length) * 100;
  var pf = grossL > 0 ? (grossW / grossL) : (grossW > 0 ? Infinity : 0);

  stats.appendChild(journalStatCell('Trades', String(journal.length), 'text-slate-200'));
  stats.appendChild(journalStatCell('Win Rate', wr.toFixed(0) + '%', wr >= 50 ? 'text-neongreen' : 'text-neonamber'));
  stats.appendChild(journalStatCell('Profit Factor', pf === Infinity ? 'INF' : pf.toFixed(2), pf >= 1 ? 'text-neongreen' : 'text-neonred'));
  stats.appendChild(journalStatCell('Avg R', (sumR / journal.length).toFixed(2) + 'R', sumR >= 0 ? 'text-neoncyan' : 'text-neonred'));
  stats.appendChild(journalStatCell('Best', fmtUsd(best.pnl), 'text-neongreen'));
  stats.appendChild(journalStatCell('Worst', fmtUsd(worst.pnl), 'text-neonred'));

  journal.slice().reverse().forEach(function (j) {
    var card = document.createElement('div');
    card.className = 'border rounded-sm px-3 py-2 space-y-1 ' + (j.pnl >= 0 ? 'border-neongreen/25 bg-neongreen/5' : 'border-neonred/25 bg-neonred/5');

    var top = document.createElement('div');
    top.className = 'flex flex-wrap items-center gap-x-3 gap-y-1';
    var dirEl = document.createElement('span');
    dirEl.className = 'font-orbitron text-[10px] uppercase ' + (j.dir === 1 ? 'text-neongreen' : 'text-neonred');
    dirEl.textContent = (j.dir === 1 ? 'LONG' : 'SHORT') + ' ' + (ASSETS[j.symbol] ? ASSETS[j.symbol].label : j.symbol);
    var whyEl = document.createElement('span');
    whyEl.className = 'text-slate-500 uppercase text-[10px]';
    whyEl.textContent = j.why + ' // held ' + fmtHold(j.hold);
    var pnlEl = document.createElement('span');
    pnlEl.className = 'ml-auto font-orbitron text-xs ' + (j.pnl >= 0 ? 'text-neongreen' : 'text-neonred');
    pnlEl.textContent = fmtUsd(j.pnl) + ' (' + (j.r >= 0 ? '+' : '') + j.r.toFixed(2) + 'R)';
    top.appendChild(dirEl); top.appendChild(whyEl); top.appendChild(pnlEl);

    var meta = document.createElement('p');
    meta.className = 'text-slate-600 text-[10px]';
    meta.textContent = new Date(j.t).toLocaleString() + (j.strat ? ' // ' + j.strat : '');

    var note = document.createElement('p');
    note.className = 'text-slate-400 leading-relaxed';
    note.textContent = 'POST-MORTEM: ' + j.note;

    card.appendChild(top); card.appendChild(meta); card.appendChild(note);
    list.appendChild(card);
  });
}

document.getElementById('journal-export').addEventListener('click', function () {
  var blob = new Blob([JSON.stringify(journal, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'omnitradex-journal-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  aiPrint('> JOURNAL EXPORTED: ' + journal.length + ' entries downloaded as JSON.', 'text-neoncyan');
});

// two-step clear (window.confirm is blocked in sandboxed frames)
var journalClearArmed = false;
document.getElementById('journal-clear').addEventListener('click', function () {
  var btn = this;
  if (!journalClearArmed) {
    journalClearArmed = true;
    btn.textContent = 'Confirm?';
    setTimeout(function () { journalClearArmed = false; btn.textContent = 'Clear'; }, 3000);
    return;
  }
  journal = [];
  saveJournal();
  renderJournal();
  journalClearArmed = false;
  btn.textContent = 'Clear';
  aiPrint('> JOURNAL PURGED: post-mortem log wiped from local sandbox.', 'text-neonamber');
});
