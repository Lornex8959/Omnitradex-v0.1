'use strict';
/* OmniTradeX Engine // module: core — load order matters, see index.html */

  /* ================================================================
 OMNITRADEX ENGINE (QUANTUM CORE v3) // COGNITIVE TRADING SYSTEM
 ================================================================ */
  
/* ---------------- ASSET REGISTRY ---------------- */
var ASSETS = {
  BTCUSDT:  { type: 'crypto', label: 'BTC/USDT',  decimals: 2, prefix: '$' },
  ETHUSDT:  { type: 'crypto', label: 'ETH/USDT',  decimals: 2, prefix: '$' },
  SOLUSDT:  { type: 'crypto', label: 'SOL/USDT',  decimals: 2, prefix: '$' },
  XRPUSDT:  { type: 'crypto', label: 'XRP/USDT',  decimals: 4, prefix: '$' },
  BNBUSDT:  { type: 'crypto', label: 'BNB/USDT',  decimals: 2, prefix: '$' },
  DOGEUSDT: { type: 'crypto', label: 'DOGE/USDT', decimals: 5, prefix: '$' },
  EURUSD:  { type: 'forex', label: 'EUR/USD', decimals: 5, prefix: '', base: 1.0842 },
  GBPUSD:  { type: 'forex', label: 'GBP/USD', decimals: 5, prefix: '', base: 1.2718 },
  USDJPY:  { type: 'forex', label: 'USD/JPY', decimals: 3, prefix: '', base: 157.42 },
  AUDUSD:  { type: 'forex', label: 'AUD/USD', decimals: 5, prefix: '', base: 0.6641 },
  USDCHF:  { type: 'forex', label: 'USD/CHF', decimals: 5, prefix: '', base: 0.8934 },
  USDCAD:  { type: 'forex', label: 'USD/CAD', decimals: 5, prefix: '', base: 1.3712 }
};

var MAX_POINTS = 50;
var state = {
  active: 'BTCUSDT',
  buffers: {},   // symbol -> [prices] (max 50)
  last: {},      // symbol -> { price, delta }
  forexTimer: null,
  ws: null,
  lastTickAt: 0
};
Object.keys(ASSETS).forEach(function (s) {
  state.buffers[s] = [];
  state.last[s] = { price: null, delta: 0 };
});

/* ---------------- DOM HOOKS ---------------- */
var el = {
  price: document.getElementById('ticker-price'),
  delta: document.getElementById('ticker-delta'),
  sl: document.getElementById('risk-sl'),
  tp: document.getElementById('risk-tp'),
  hudPair: document.getElementById('hud-pair'),
  hudFeed: document.getElementById('hud-feed'),
  hudLatency: document.getElementById('hud-latency'),
  canvas: document.getElementById('waveform-canvas'),
  wrap: document.getElementById('waveform-wrap'),
  standby: document.getElementById('waveform-standby'),
  aiLog: document.getElementById('ai-log'),
  aiBtn: document.getElementById('btn-ai-trigger'),
  aiStatus: document.getElementById('ai-status'),
  loader: document.getElementById('terminalLoader'),
  aiOutput: document.getElementById('aiOutputText'),
  keysBtn: document.getElementById('btn-decipher-keys'),
  deck: document.getElementById('strategy-deck'),
  walletForm: document.getElementById('wallet-form'),
  walletInput: document.getElementById('wallet-input'),
  walletTag: document.getElementById('wallet-tag'),
  walletList: document.getElementById('wallet-list'),
  tabs: Array.prototype.slice.call(document.querySelectorAll('.asset-tab'))
};

/* ---------------- FOOTER TELEMETRY (fixed ID targeting) ---------------- */
function setFooterUplink(text) {
  var s = document.getElementById('ftr-uplink');
  s.textContent = text;
  s.className = text === 'ACTIVE' ? 'text-neongreen' : 'text-neonamber';
}
function setFooterKeys(deciphered) {
  var s = document.getElementById('ftr-keys');
  s.textContent = deciphered ? 'DECIPHERED' : 'NOT DECIPHERED';
  s.className = deciphered ? 'text-neongreen' : 'text-neonmagenta';
}

/* ---------------- FORMATTERS ---------------- */
function fmtPrice(symbol, price) {
  var a = ASSETS[symbol];
  if (price == null) return a.prefix + '--.--';
  return a.prefix + price.toLocaleString('en-US', {
    minimumFractionDigits: a.decimals,
    maximumFractionDigits: a.decimals
  });
}

/* ---------------- ANOMALOUS STREAM DETECTOR ---------------- */
var anomalyCount = 0;
var lastAnomalyAt = {}; // symbol -> timestamp (rate limit per symbol)

function logAnomaly(symbol, kind, detail) {
  var now = Date.now();
  if (now - (lastAnomalyAt[symbol] || 0) < 15000) return; // max 1 event / 15s per symbol
  lastAnomalyAt[symbol] = now;
  anomalyCount++;
  document.getElementById('anomaly-count').textContent = 'EVT LOG // ' + String(Math.min(anomalyCount, 99)).padStart(2, '0');

  var log = document.getElementById('anomaly-log');
  var row = document.createElement('div');
  row.className = 'flex gap-2 text-slate-400';
  var ts = document.createElement('span');
  ts.className = 'text-neonamber shrink-0';
  ts.textContent = '[' + new Date().toISOString().slice(11, 19) + ']';
  var msg = document.createElement('span');
  var badge = document.createElement('span');
  badge.className = 'text-neonred font-semibold';
  badge.textContent = kind + ' ';
  msg.appendChild(badge);
  msg.appendChild(document.createTextNode(ASSETS[symbol].label + ' — ' + detail));
  row.appendChild(ts); row.appendChild(msg);
  log.insertBefore(row, log.firstChild);
  while (log.children.length > 30) log.removeChild(log.lastChild);
}

function detectAnomaly(symbol, price) {
  var buf = state.buffers[symbol];
  if (buf.length < 12) return;
  // rolling mean + stddev of last 20 tick-to-tick moves
  var win = buf.slice(-21);
  var moves = [];
  for (var i = 1; i < win.length; i++) moves.push((win[i] - win[i - 1]) / win[i - 1]);
  var mean = 0;
  for (var j = 0; j < moves.length; j++) mean += moves[j];
  mean /= moves.length;
  var variance = 0;
  for (var k = 0; k < moves.length; k++) variance += Math.pow(moves[k] - mean, 2);
  var sd = Math.sqrt(variance / moves.length);
  if (!sd) return;
  var lastMove = (price - buf[buf.length - 2]) / buf[buf.length - 2];
  var z = (lastMove - mean) / sd;
  if (Math.abs(z) >= 3) {
    logAnomaly(symbol, Math.abs(z) >= 4 ? 'CASCADE' : 'VOL-SPIKE',
      (lastMove >= 0 ? '+' : '') + (lastMove * 100).toFixed(3) + '% tick move @ ' + Math.abs(z).toFixed(1) + 'σ');
  }
}
