'use strict';
/* OmniTradeX Engine // module: arena — load order matters, see index.html */

/* ================================================================
   PHASE 7 // MODULE 2: AI ARENA — QUANTUM COLOSSEUM
   Six AI trader personas battle on the SAME live tick buffers,
   each with a distinct strategy brain. Paper-only, ranked live.
   ================================================================ */
var ARENA_SLOT = 'qc3_arena';
var ARENA_BOTS = [
  { id: 'titan',   name: 'GPT-TITAN',      style: 'momentum',  color: 'text-neoncyan',    desc: 'Momentum breakout hunter' },
  { id: 'sage',    name: 'CLAUDE-SAGE',    style: 'structure', desc: 'Wyckoff structure reader', color: 'text-neonmagenta' },
  { id: 'nova',    name: 'GEMINI-NOVA',    style: 'meanrev',   desc: '3-sigma fade specialist',  color: 'text-neonamber' },
  { id: 'viper',   name: 'LLAMA-VIPER',    style: 'scalper',   desc: 'Fast-window tick scalper', color: 'text-neongreen' },
  { id: 'maverick',name: 'GROK-MAVERICK',  style: 'contrarian',desc: 'Crowd-fade contrarian',    color: 'text-neonred' },
  { id: 'oracle',  name: 'DEEPSEEK-ORACLE',style: 'trend',     desc: 'Slow-trend rider',         color: 'text-slate-300' }
];
var arena = { season: 1, stats: {} };
try {
  var savedArena = JSON.parse(localStorage.getItem(ARENA_SLOT));
  if (savedArena && savedArena.stats) arena = savedArena;
} catch (e) { /* new season */ }
ARENA_BOTS.forEach(function (b) {
  if (!arena.stats[b.id]) arena.stats[b.id] = { equity: 10000, wins: 0, losses: 0 };
});
var botPositions = {}; // id -> open position (session-scoped)

function saveArena() { localStorage.setItem(ARENA_SLOT, JSON.stringify(arena)); }

function arenaTape(who, text, cls) {
  var tape = document.getElementById('arena-tape');
  if (!tape) return;
  var row = document.createElement('p');
  row.className = cls || 'text-slate-400';
  row.textContent = '[' + new Date().toISOString().slice(11, 19) + '] ' + who + ' :: ' + text;
  tape.insertBefore(row, tape.firstChild);
  while (tape.children.length > 40) tape.removeChild(tape.lastChild);
}

/* Each persona reads the live buffers through its own strategy lens */
function botSignal(style, symbol) {
  var buf = state.buffers[symbol];
  if (buf.length < 20) return 0;
  var fast = windowTrend(buf, 10), mid = windowTrend(buf, 25), slow = windowTrend(buf, 50);
  switch (style) {
    case 'momentum':   return (fast.z > 1.2 && mid.z > 0.5) ? 1 : (fast.z < -1.2 && mid.z < -0.5) ? -1 : 0;
    case 'trend':      return (slow.z > 1.0 && mid.dir !== 'BEAR') ? 1 : (slow.z < -1.0 && mid.dir !== 'BULL') ? -1 : 0;
    case 'meanrev':    return fast.z > 2.2 ? -1 : fast.z < -2.2 ? 1 : 0;
    case 'contrarian': return (fast.z > 1.6 && slow.dir === 'FLAT') ? -1 : (fast.z < -1.6 && slow.dir === 'FLAT') ? 1 : 0;
    case 'scalper':    return fast.z > 0.9 ? 1 : fast.z < -0.9 ? -1 : 0;
    case 'structure':  return (mid.dir === 'FLAT' && slow.z > 0.6) ? 1 : (mid.dir === 'FLAT' && slow.z < -0.6) ? -1 : 0;
    default: return 0;
  }
}

var ARENA_SYMBOLS = Object.keys(ASSETS);

function arenaDecide() {
  ARENA_BOTS.forEach(function (bot) {
    var st = arena.stats[bot.id];
    var pos = botPositions[bot.id];

    if (pos) {
      // manage open position: SL/TP or 3-minute time stop
      var d = state.last[pos.symbol];
      if (!d || d.price == null) return;
      var p = d.price, exit = null, why = '';
      if (pos.dir === 1 && p <= pos.sl) { exit = pos.sl; why = 'STOP'; }
      else if (pos.dir === 1 && p >= pos.tp) { exit = pos.tp; why = 'TARGET'; }
      else if (pos.dir === -1 && p >= pos.sl) { exit = pos.sl; why = 'STOP'; }
      else if (pos.dir === -1 && p <= pos.tp) { exit = pos.tp; why = 'TARGET'; }
      else if (Date.now() - pos.t > 180000) { exit = p; why = 'TIME'; }
      if (exit != null) {
        var pnl = (exit - pos.entry) * pos.qty * pos.dir;
        st.equity += pnl;
        if (pnl >= 0) st.wins++; else st.losses++;
        delete botPositions[bot.id];
        saveArena();
        arenaTape(bot.name, why + ' ' + ASSETS[pos.symbol].label + ' -> ' + fmtUsd(pnl), pnl >= 0 ? 'text-neongreen' : 'text-neonred');
      }
      return;
    }

    // hunt for an entry (probabilistic scan keeps the tape organic)
    if (Math.random() > 0.5) return;
    var symbol = ARENA_SYMBOLS[Math.floor(Math.random() * ARENA_SYMBOLS.length)];
    var sig = botSignal(bot.style, symbol);
    if (!sig) return;
    var d2 = state.last[symbol];
    if (!d2 || d2.price == null) return;
    var entry = d2.price;
    var t = trail[symbol];
    var slPct = t ? t.pct : 0.015;
    var sl = entry * (1 - sig * slPct);
    var tp = entry * (1 + sig * slPct * 2);
    var qty = (st.equity * 0.01) / Math.abs(entry - sl);
    botPositions[bot.id] = { symbol: symbol, dir: sig, entry: entry, sl: sl, tp: tp, qty: qty, t: Date.now() };
    arenaTape(bot.name, (sig === 1 ? 'LONG ' : 'SHORT ') + ASSETS[symbol].label + ' @ ' + fmtPrice(symbol, entry), bot.color);
  });
  renderArena();
}

function renderArena() {
  var board = document.getElementById('arena-board');
  if (!board) return;
  var rows = ARENA_BOTS.map(function (b) {
    var st = arena.stats[b.id];
    var total = st.wins + st.losses;
    return { name: b.name, desc: b.desc, color: b.color, equity: st.equity, wr: total ? st.wins / total : 0, trades: total, you: false, live: !!botPositions[b.id] };
  });
  var myTotal = ledger.wins + ledger.losses;
  rows.push({ name: 'YOU // HUMAN DESK', desc: 'Directive-driven sim trader', color: 'text-neongreen', equity: ledger.equity, wr: myTotal ? ledger.wins / myTotal : 0, trades: myTotal, you: true, live: !!ledger.open.length });
  rows.sort(function (a, b) { return b.equity - a.equity; });

  board.innerHTML = '';
  rows.forEach(function (r, i) {
    var card = document.createElement('div');
    card.className = 'border rounded-sm px-3 py-2 flex items-center gap-3 ' + (r.you ? 'border-neongreen/50 bg-neongreen/5' : 'border-gridline');
    var rank = document.createElement('span');
    rank.className = 'font-orbitron text-xs w-6 ' + (i === 0 ? 'text-neonamber' : 'text-slate-500');
    rank.textContent = String(i + 1).padStart(2, '0');
    var mid = document.createElement('div');
    mid.className = 'flex-1 min-w-0';
    var nm = document.createElement('p');
    nm.className = r.color + ' truncate';
    nm.textContent = r.name + (r.live ? ' •' : '');
    var ds = document.createElement('p');
    ds.className = 'text-[10px] text-slate-600 truncate';
    ds.textContent = r.desc;
    mid.appendChild(nm); mid.appendChild(ds);
    var eq = document.createElement('span');
    eq.className = 'shrink-0 ' + (r.equity >= 10000 ? 'text-neongreen' : 'text-neonred');
    eq.textContent = fmtUsd(r.equity);
    var wr = document.createElement('span');
    wr.className = 'shrink-0 text-slate-500 w-24 text-right';
    wr.textContent = (r.wr * 100).toFixed(0) + '% // ' + r.trades + 'T';
    card.appendChild(rank); card.appendChild(mid); card.appendChild(eq); card.appendChild(wr);
    board.appendChild(card);
  });
  var sess = document.getElementById('arena-session');
  if (sess) sess.textContent = 'SEASON: ' + arena.season;
  if (!breakerTripped()) {
    document.getElementById('arena-breaker').innerHTML = 'CIRCUIT: <span class="text-neongreen">ARMED</span>';
  }
}

document.getElementById('btn-arena-reset').addEventListener('click', function () {
  arena.season++;
  ARENA_BOTS.forEach(function (b) { arena.stats[b.id] = { equity: 10000, wins: 0, losses: 0 }; });
  botPositions = {};
  ledger.equity = 10000; ledger.dayStart = 10000; ledger.wins = 0; ledger.losses = 0; ledger.open = []; ledger.closed = [];
  saveArena(); saveLedger();
  updateSimHud(); renderDesk(); renderArena();
  arenaTape('SYS', 'Season ' + arena.season + ' started. All desks reset to $10,000.', 'text-neonamber');
});
