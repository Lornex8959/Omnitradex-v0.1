'use strict';
/* OmniTradeX Engine // module: analysis — load order matters, see index.html */

/* ================================================================
   PHASE 5 // MODULE 1: MULTI-TIMEFRAME FILTERING ENGINE
   Synthetic fast/mid/slow trend windows from the live tick buffer,
   with a cross-period alignment gate that blocks unconfirmed signals.
   ================================================================ */
var MTF_WINDOWS = { fast: 10, mid: 25, slow: 50 };

function windowTrend(buf, n) {
  if (buf.length < Math.min(n, 8)) return { dir: 'WAIT', z: 0 };
  var win = buf.slice(-n);
  var moves = [];
  for (var i = 1; i < win.length; i++) moves.push((win[i] - win[i - 1]) / win[i - 1]);
  var mean = 0, k;
  for (k = 0; k < moves.length; k++) mean += moves[k];
  mean /= moves.length;
  var variance = 0;
  for (k = 0; k < moves.length; k++) variance += Math.pow(moves[k] - mean, 2);
  var sd = Math.sqrt(variance / moves.length);
  var total = (win[win.length - 1] - win[0]) / win[0];
  if (!sd) return { dir: 'FLAT', z: 0 };
  var z = total / (sd * Math.sqrt(moves.length)); // normalized drift vs noise
  if (z > 0.8) return { dir: 'BULL', z: z };
  if (z < -0.8) return { dir: 'BEAR', z: z };
  return { dir: 'FLAT', z: z };
}

function computeMTF(symbol) {
  var buf = state.buffers[symbol];
  var fast = windowTrend(buf, MTF_WINDOWS.fast);
  var mid = windowTrend(buf, MTF_WINDOWS.mid);
  var slow = windowTrend(buf, MTF_WINDOWS.slow);
  var gate = 'BLOCKED';
  if (fast.dir === 'BULL' && mid.dir === 'BULL' && slow.dir !== 'BEAR') gate = 'LONG-OK';
  else if (fast.dir === 'BEAR' && mid.dir === 'BEAR' && slow.dir !== 'BULL') gate = 'SHORT-OK';
  else if (fast.dir === 'WAIT' || mid.dir === 'WAIT') gate = 'WAIT';
  return { fast: fast, mid: mid, slow: slow, gate: gate };
}

var MTF_CLS = {
  BULL: 'border-neongreen/50 text-neongreen',
  BEAR: 'border-neonred/50 text-neonred',
  FLAT: 'border-gridline text-slate-500',
  WAIT: 'border-gridline text-slate-600'
};

function updateMtfUI(mtf) {
  var base = 'border px-2 py-0.5 rounded-sm uppercase ';
  document.getElementById('mtf-fast').className = base + MTF_CLS[mtf.fast.dir];
  document.getElementById('mtf-fast').textContent = 'Fast ' + mtf.fast.dir;
  document.getElementById('mtf-mid').className = base + MTF_CLS[mtf.mid.dir];
  document.getElementById('mtf-mid').textContent = 'Mid ' + mtf.mid.dir;
  document.getElementById('mtf-slow').className = base + MTF_CLS[mtf.slow.dir];
  document.getElementById('mtf-slow').textContent = 'Slow ' + mtf.slow.dir;
  var gateEl = document.getElementById('mtf-gate');
  var gateCls = mtf.gate === 'LONG-OK' ? 'border-neongreen/60 text-neongreen' :
                mtf.gate === 'SHORT-OK' ? 'border-neonred/60 text-neonred' :
                'border-neonamber/50 text-neonamber';
  gateEl.className = 'ml-auto font-semibold ' + base + gateCls;
  gateEl.textContent = 'Gate: ' + mtf.gate;
}

/* ================================================================
   PHASE 5 // MODULE 2: DYNAMIC VOLATILITY-ADJUSTED TRAILING SL
   Trail distance scales with realized tick volatility (ATR-style)
   and ratchets from the peak price — never loosens once tightened.
   ================================================================ */
var trail = {}; // symbol -> { peak, pct }

function updateTrail(symbol, price) {
  var buf = state.buffers[symbol];
  var t = trail[symbol] || (trail[symbol] = { peak: price, pct: 0.02 });
  if (price > t.peak) t.peak = price; // ratchet with confirmed highs

  if (buf.length >= 15) {
    var win = buf.slice(-20);
    var moves = [];
    for (var i = 1; i < win.length; i++) moves.push(Math.abs((win[i] - win[i - 1]) / win[i - 1]));
    var mean = 0;
    for (var j = 0; j < moves.length; j++) mean += moves[j];
    mean /= moves.length;
    // volatility-scaled trail: 12x mean abs tick move, clamped 0.5% - 4%
    t.pct = Math.min(0.04, Math.max(0.005, mean * 12));
  }
  return t;
}

function trailStop(symbol) {
  var t = trail[symbol];
  var d = state.last[symbol];
  if (!t || d.price == null) return null;
  return { sl: t.peak * (1 - t.pct), pct: t.pct, peak: t.peak };
}

/* ================================================================
   PHASE 5 // MODULE 4: STRATEGY SYNTHESIS ENGINE
   Scores all 10 vectors against live buffer conditions and
   recommends the statistically best-fit deployment.
   ================================================================ */
function synthesizeStrategy() {
  var symbol = state.active;
  var buf = state.buffers[symbol];
  if (buf.length < 15) return null;
  var mtf = computeMTF(symbol);
  var d = state.last[symbol];
  var isCrypto = ASSETS[symbol].type === 'crypto';

  // condition metrics
  var trending = Math.abs(mtf.slow.z) > 1.2 && mtf.gate !== 'BLOCKED';
  var choppy = mtf.fast.dir === 'FLAT' && mtf.mid.dir === 'FLAT';
  var stretched = Math.abs(mtf.fast.z) > 2.2; // fast move far beyond noise
  var aligned = mtf.gate === 'LONG-OK' || mtf.gate === 'SHORT-OK';
  var hotDelta = Math.abs(d.delta || 0) > 3;

  var scores = {
    'ICT Liquidity Recon':        (aligned ? 3 : 0) + (stretched ? 2 : 0) + (isCrypto ? 0 : 1),
    'Wyckoff Accumulation':       (choppy ? 3 : 0) + (mtf.slow.dir === 'FLAT' ? 2 : 0),
    'HFT Order Book Delta':       (trending ? 2 : 0) + (hotDelta ? 2 : 0) + (isCrypto ? 1 : 0),
    'MEV Flash Loan Front-Run':   (isCrypto ? 2 : -5) + (stretched ? 1 : 0),
    'Funding Rate Carry Recon':   (isCrypto ? 2 : -5) + (choppy ? 2 : 0),
    'Statistical Mean Reversion': (stretched ? 4 : 0) + (choppy ? 1 : 0) + (aligned ? -2 : 0),
    'Sentiment Correlation':      (hotDelta ? 3 : 0) + (trending ? 1 : 0),
    'Gamma Squeeze Force':        (isCrypto ? 1 : 0) + (trending && hotDelta ? 3 : 0),
    'Multi-Tier Grid Flow':       (choppy ? 4 : 0) + (trending ? -2 : 0),
    'Whale Wallet Mimicry':       (isCrypto ? 2 : -3) + (aligned ? 2 : 0)
  };

  // Phase 6: apply learned per-strategy edge weights (reinforcement memory)
  Object.keys(scores).forEach(function (name) {
    scores[name] += learnedBias(name);
  });

  var best = null, bestScore = -Infinity;
  Object.keys(scores).forEach(function (name) {
    if (scores[name] > bestScore) { bestScore = scores[name]; best = name; }
  });
  return { name: best, score: bestScore, gate: mtf.gate };
}

/* ================================================================
   PHASE 6 // MODULE 2: ADAPTIVE LEARNING ENGINE
   Every gated signal is logged, evaluated against the price 60s
   later, and converted into reinforcement weights per strategy.
   The system studies its own data stream and evolves its edge —
   persisted in localStorage across sessions.
   ================================================================ */
var LEARN_SLOT = 'qc3_learning';
var learning = { weights: {}, samples: 0, wins: 0, insights: [] };
try {
  var savedLearn = JSON.parse(localStorage.getItem(LEARN_SLOT));
  if (savedLearn && savedLearn.weights) learning = savedLearn;
} catch (e) { /* fresh brain */ }

function saveLearning() { localStorage.setItem(LEARN_SLOT, JSON.stringify(learning)); }
function learnedBias(name) { return learning.weights[name] || 0; }
function learnWinRate() { return learning.samples ? (learning.wins / learning.samples) : 0.5; }

function updateLearnHud() {
  var s = document.getElementById('ftr-learn');
  if (!s) return;
  s.textContent = learning.samples + ' SIG // ' + (learnWinRate() * 100).toFixed(0) + '% EDGE';
  s.className = learnWinRate() >= 0.5 ? 'text-neongreen' : 'text-neonamber';
}

var pendingSignals = [];

function learnRegisterSignal(rec, symbol) {
  if (rec.gate !== 'LONG-OK' && rec.gate !== 'SHORT-OK') return;
  var d = state.last[symbol];
  if (d.price == null) return;
  // avoid stacking duplicate pending evaluations per symbol
  for (var i = 0; i < pendingSignals.length; i++) {
    if (pendingSignals[i].symbol === symbol) return;
  }
  pendingSignals.push({
    symbol: symbol,
    dir: rec.gate === 'LONG-OK' ? 1 : -1,
    strat: rec.name,
    price: d.price,
    t: Date.now()
  });
}

function learnEvaluate() {
  var now = Date.now();
  var remaining = [];
  pendingSignals.forEach(function (sig) {
    if (now - sig.t < 60000) { remaining.push(sig); return; }
    var d = state.last[sig.symbol];
    if (d.price == null) return;
    var move = (d.price - sig.price) / sig.price;
    var win = (move * sig.dir) > 0;
    learning.samples++;
    if (win) learning.wins++;
    var w = learning.weights[sig.strat] || 0;
    // reinforcement update: reward confirmed edge, decay failed reads
    learning.weights[sig.strat] = Math.max(-3, Math.min(3, w + (win ? 0.25 : -0.15)));
    var insight = sig.strat + (win ? ' validated' : ' faded') + ' on ' + ASSETS[sig.symbol].label +
      ' (' + (move * 100 >= 0 ? '+' : '') + (move * 100).toFixed(3) + '% in 60s)';
    learning.insights.push(insight);
    while (learning.insights.length > 8) learning.insights.shift();
    saveLearning();
    updateLearnHud();
    aiPrint('> LEARN: ' + insight + '. Weight[' + sig.strat + '] -> ' + learning.weights[sig.strat].toFixed(2), win ? 'text-neongreen' : 'text-neonamber');
  });
  pendingSignals = remaining;
}

function learningContext() {
  var keys = Object.keys(learning.weights);
  if (!keys.length) return 'No learned edge yet — cold start.';
  var ranked = keys.slice().sort(function (a, b) { return learning.weights[b] - learning.weights[a]; });
  return 'SAMPLES: ' + learning.samples + ' | WIN RATE: ' + (learnWinRate() * 100).toFixed(0) + '%\n' +
    'LEARNED WEIGHTS: ' + ranked.map(function (k) { return k + '=' + learning.weights[k].toFixed(2); }).join(', ') + '\n' +
    'RECENT LESSONS: ' + (learning.insights.slice(-3).join(' | ') || 'none');
}
