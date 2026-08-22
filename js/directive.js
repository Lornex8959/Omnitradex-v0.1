'use strict';
/* OmniTradeX Engine // module: directive — load order matters, see index.html */

/* ================================================================
   PHASE 6 // MODULE 3: ELITE TRADE DIRECTIVE ENGINE
   Synthesizes MTF gate + volatility trail + learned edge into a
   fully tailored trade card, like a full-time elite desk trader.
   ================================================================ */
function buildTradeDirective() {
  var symbol = state.active;
  var d = state.last[symbol];
  var buf = state.buffers[symbol];
  if (d.price == null || buf.length < 15) return null;
  var mtf = computeMTF(symbol);
  var ts = trailStop(symbol);
  var rec = state.synthRec;
  var slPct = ts ? ts.pct : 0.02;

  var stand = state.execPaused || (mtf.gate !== 'LONG-OK' && mtf.gate !== 'SHORT-OK');
  var dir = mtf.gate === 'LONG-OK' ? 'LONG' : mtf.gate === 'SHORT-OK' ? 'SHORT' : 'STAND ASIDE';
  var sign = dir === 'SHORT' ? -1 : 1;

  // confidence: alignment strength + learned edge + trap penalty
  var conf = 40 + Math.min(25, Math.abs(mtf.mid.z) * 8) + Math.min(15, Math.abs(mtf.slow.z) * 5);
  conf += (learnWinRate() - 0.5) * 40;
  if (rec) conf += Math.min(10, Math.max(0, rec.score));
  if (state.execPaused) conf = Math.min(conf, 15);
  conf = Math.max(5, Math.min(96, Math.round(conf)));

  var entry = d.price;
  var sl = stand ? null : entry * (1 - sign * slPct);
  var tp = stand ? null : entry * (1 + sign * slPct * 2); // 2R discipline
  // risk-based position sizing: 1% account risk / SL distance, scaled by confidence
  var sizePct = stand ? 0 : Math.min(5, (1 / (slPct * 100)) * (conf / 100) * 2);

  return {
    symbol: symbol, dir: dir, stand: stand, conf: conf,
    entry: entry, sl: sl, tp: tp, sizePct: sizePct,
    strat: rec ? rec.name : activeStrategy(),
    reason: state.execPaused ? 'Manipulation trap active on monitored node — capital preservation override.' :
      stand ? 'MTF gate ' + mtf.gate + ' — cross-period confirmation missing. Elite desks wait.' :
      'MTF aligned ' + dir + ' (mid z=' + mtf.mid.z.toFixed(2) + '), vol-adjusted trail ' + (slPct * 100).toFixed(1) + '%, learned edge ' + (learnWinRate() * 100).toFixed(0) + '%.'
  };
}

function renderTradeDirective() {
  var box = document.getElementById('trade-directive');
  var confEl = document.getElementById('directive-conf');
  var td = buildTradeDirective();
  if (!td) return;
  confEl.textContent = 'CONF // ' + td.conf + '%';
  confEl.className = 'font-techmono text-[10px] ' + (td.conf >= 65 ? 'text-neongreen' : td.conf >= 40 ? 'text-neonamber' : 'text-neonred');
  box.innerHTML = '';

  var head = document.createElement('p');
  head.className = 'font-orbitron text-xs uppercase ' + (td.dir === 'LONG' ? 'text-neongreen glow-green' : td.dir === 'SHORT' ? 'text-neonred' : 'text-neonamber');
  head.textContent = td.dir + ' // ' + ASSETS[td.symbol].label + ' // ' + td.strat;
  box.appendChild(head);

  if (!td.stand) {
    var grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-400';
    [['ENTRY', fmtPrice(td.symbol, td.entry)],
     ['SIZE', td.sizePct.toFixed(1) + '% acct (1% risk)'],
     ['STOP', fmtPrice(td.symbol, td.sl)],
     ['TARGET (2R)', fmtPrice(td.symbol, td.tp)]].forEach(function (pair) {
      var s = document.createElement('span');
      var lbl = document.createElement('span');
      lbl.className = 'text-slate-600 uppercase mr-1.5';
      lbl.textContent = pair[0] + ':';
      s.appendChild(lbl);
      s.appendChild(document.createTextNode(pair[1]));
      grid.appendChild(s);
    });
    box.appendChild(grid);
  }

  var why = document.createElement('p');
  why.className = 'text-slate-500 leading-relaxed';
  why.textContent = td.reason;
  box.appendChild(why);
}

state.synthRec = null;

function runSynthesis(announce) {
  var rec = synthesizeStrategy();
  if (!rec) return;
  var changed = !state.synthRec || state.synthRec.name !== rec.name;
  state.synthRec = rec;
  learnRegisterSignal(rec, state.active); // Phase 6: feed the adaptive learning loop
  // move the AI-FIT badge to the recommended card
  el.deck.querySelectorAll('.synth-badge').forEach(function (b) { b.remove(); });
  Array.prototype.forEach.call(el.deck.querySelectorAll('.strategy-card'), function (card) {
    if (card.querySelector('p').textContent === rec.name) {
      var badge = document.createElement('span');
      badge.className = 'synth-badge shrink-0 border border-neonamber/60 text-neonamber text-[9px] px-1.5 py-0.5 rounded-sm uppercase font-orbitron';
      badge.textContent = 'AI-Fit';
      card.appendChild(badge);
    }
  });
  if (announce && changed) {
    aiPrint('> SYNTHESIS: best-fit vector for live conditions -> ' + rec.name.toUpperCase() + ' (gate ' + rec.gate + ')', 'text-neonamber');
  }
}

/* ---------------- TICK INGESTION ---------------- */
function ingestTick(symbol, price, deltaPct) {
  var buf = state.buffers[symbol];
  if (buf.length) detectAnomaly(symbol, price);
  buf.push(price);
  if (buf.length > MAX_POINTS) buf.shift();
  // Phase 9: session tape — longer memory than the HUD buffer, feeds the backtest replay
  if (!state.tape) state.tape = {};
  if (!state.tape[symbol]) state.tape[symbol] = [];
  state.tape[symbol].push(price);
  if (state.tape[symbol].length > 900) state.tape[symbol].shift();
  state.last[symbol] = { price: price, delta: deltaPct };
  updateTrail(symbol, price);
  if (symbol === state.active && !document.hidden) renderActive();
}

function renderActive() {
  var symbol = state.active;
  var a = ASSETS[symbol];
  var d = state.last[symbol];
  el.hudPair.textContent = a.label;

  if (d.price == null) {
    // no data yet for this asset: show placeholders instead of a stale readout
    el.price.textContent = a.prefix + '--,---.--';
    el.price.className = 'font-orbitron text-3xl font-700 text-slate-600';
    el.delta.textContent = '+ -.-- %';
    el.delta.className = 'font-techmono text-sm text-slate-600';
    el.sl.textContent = a.prefix + '--,---.--';
    el.tp.textContent = a.prefix + '--,---.--';
    drawWaveform();
    return;
  }

  if (el.standby) { el.standby.style.display = 'none'; el.standby = null; }

  el.price.textContent = fmtPrice(symbol, d.price);
  var up = d.delta >= 0;
  el.delta.textContent = (up ? '+ ' : '- ') + Math.abs(d.delta).toFixed(2) + ' %';
  el.delta.className = 'font-techmono text-sm ' + (up ? 'text-neongreen' : 'text-neonred');
  el.price.className = 'font-orbitron text-3xl font-700 ' + (up ? 'text-neongreen glow-green' : 'text-neonred');

  // Phase 5: volatility-adjusted trailing SL (ratcheted from peak)
  var ts = trailStop(symbol);
  if (ts) {
    el.sl.textContent = fmtPrice(symbol, ts.sl);
    document.getElementById('risk-sl-label').textContent = 'Trail SL ' + (ts.pct * 100).toFixed(1) + '%';
  } else {
    el.sl.textContent = fmtPrice(symbol, d.price * 0.98);
  }
  el.tp.textContent = fmtPrice(symbol, d.price * 1.04);
  updateMtfUI(computeMTF(symbol));
  drawWaveform();
}

/* ---------------- NEON WAVEFORM RENDERER ---------------- */
var ctx = el.canvas.getContext('2d');
function sizeCanvas() {
  var dpr = window.devicePixelRatio || 1;
  var r = el.wrap.getBoundingClientRect();
  el.canvas.width = Math.max(1, Math.floor(r.width * dpr));
  el.canvas.height = Math.max(1, Math.floor(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', function () { sizeCanvas(); drawWaveform(); });
sizeCanvas();

function drawWaveform() {
  var buf = state.buffers[state.active];
  var w = el.canvas.width / (window.devicePixelRatio || 1);
  var h = el.canvas.height / (window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, w, h);

  // faint grid
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
  ctx.lineWidth = 1;
  for (var gx = 0; gx <= w; gx += 34) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
  }
  for (var gy = 0; gy <= h; gy += 26) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
  }
  if (buf.length < 2) return;

  var min = Math.min.apply(null, buf);
  var max = Math.max.apply(null, buf);
  var range = (max - min) || (min * 0.0005) || 1;
  var padY = 14;
  var span = Math.max(buf.length - 1, 1); // scale to real data so the line always fills the chart width
  function px(i) { return (i / span) * w; }
  function py(v) { return h - padY - ((v - min) / range) * (h - padY * 2); }

  var rising = buf[buf.length - 1] >= buf[0];
  var lineColor = rising ? '#4ade80' : '#f87171';
  var glowColor = rising ? 'rgba(74,222,128,0.85)' : 'rgba(248,113,113,0.85)';

  // area fill
  ctx.beginPath();
  ctx.moveTo(px(0), py(buf[0]));
  for (var i = 1; i < buf.length; i++) {
    var xc = (px(i - 1) + px(i)) / 2;
    var yc = (py(buf[i - 1]) + py(buf[i])) / 2;
    ctx.quadraticCurveTo(px(i - 1), py(buf[i - 1]), xc, yc);
  }
  ctx.lineTo(px(buf.length - 1), py(buf[buf.length - 1]));
  var grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, rising ? 'rgba(74,222,128,0.16)' : 'rgba(248,113,113,0.16)');
  grad.addColorStop(1, 'rgba(2,6,23,0)');
  ctx.lineTo(px(buf.length - 1), h);
  ctx.lineTo(px(0), h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // glowing neon line (smooth quadratic)
  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(px(0), py(buf[0]));
  for (var j = 1; j < buf.length; j++) {
    var xc2 = (px(j - 1) + px(j)) / 2;
    var yc2 = (py(buf[j - 1]) + py(buf[j])) / 2;
    ctx.quadraticCurveTo(px(j - 1), py(buf[j - 1]), xc2, yc2);
  }
  ctx.lineTo(px(buf.length - 1), py(buf[buf.length - 1]));
  ctx.stroke();
  ctx.restore();

  // last tick beacon
  ctx.beginPath();
  ctx.arc(px(buf.length - 1), py(buf[buf.length - 1]), 3, 0, Math.PI * 2);
  ctx.fillStyle = '#22d3ee';
  ctx.shadowColor = 'rgba(34,211,238,0.9)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
}

/* ---------------- BINANCE WEBSOCKET (CRYPTO) ---------------- */
function setFeed(text, color) {
  el.hudFeed.textContent = text;
  el.hudFeed.className = color;
}

var WS_ENDPOINTS = [
  'wss://stream.binance.com:9443/stream?streams=',
  'wss://stream.binance.us:9443/stream?streams='  // failover for geo-restricted regions (HTTP 451)
];
var wsEndpointIdx = 0;
var wsFailStreak = 0; // consecutive connections that never opened

function connectBinance() {
  var streams = 'btcusdt@ticker/ethusdt@ticker/solusdt@ticker/xrpusdt@ticker/bnbusdt@ticker/dogeusdt@ticker';
  var ws = new WebSocket(WS_ENDPOINTS[wsEndpointIdx] + streams);
  state.ws = ws;
  var openedThisConn = false;

  ws.onopen = function () {
    openedThisConn = true;
    wsFailStreak = 0;
    setFeed('LIVE', 'text-neongreen glow-green');
  };
  ws.onmessage = function (evt) {
    try {
      var msg = JSON.parse(evt.data);
      var t = msg.data;
      if (t && t.s && ASSETS[t.s]) {
        state.lastTickAt = Date.now(); // heartbeat for the stall watchdog
        // true feed latency: local clock vs Binance event timestamp (t.E, ms epoch)
        if (t.E) {
          var lat = Math.max(0, Math.min(9999, Date.now() - t.E));
          el.hudLatency.textContent = lat + ' ms';
        }
        ingestTick(t.s, parseFloat(t.c), parseFloat(t.P));
      }
    } catch (e) { /* malformed frame: ignore */ }
  };
  ws.onclose = function () {
    if (!openedThisConn) wsFailStreak++;
    if (wsFailStreak >= 1 && !openedThisConn) {
      // this endpoint is unreachable: rotate to failover
      wsEndpointIdx = (wsEndpointIdx + 1) % WS_ENDPOINTS.length;
      setFeed('FAILOVER-' + (wsEndpointIdx + 1), 'text-neonamber');
    } else {
      setFeed('RECONNECTING', 'text-neonamber');
    }
    // exponential backoff on repeated failures (2.5s -> 5s -> 10s, capped)
    var wait = Math.min(10000, 2500 * Math.pow(2, Math.max(0, wsFailStreak - 1)));
    setTimeout(connectBinance, wait);
  };
  ws.onerror = function () { ws.close(); };
}

/* ---------------- FOREX MOCK GENERATOR ---------------- */
function seedForex() {
  Object.keys(ASSETS).forEach(function (s) {
    if (ASSETS[s].type !== 'forex') return;
    var p = ASSETS[s].base;
    for (var i = 0; i < MAX_POINTS; i++) {
      p += p * (Math.random() - 0.5) * 0.00012; // fractions of a pip
      state.buffers[s].push(p);
      if (state.buffers[s].length > MAX_POINTS) state.buffers[s].shift();
    }
    state.last[s] = { price: p, delta: ((p - ASSETS[s].base) / ASSETS[s].base) * 100 };
  });
}

function startForexEngine() {
  if (state.forexTimer) return;
  state.forexTimer = setInterval(function () {
    Object.keys(ASSETS).forEach(function (s) {
      if (ASSETS[s].type !== 'forex') return;
      var prev = state.last[s].price || ASSETS[s].base;
      // random walk: small fraction of a pip per 2s cycle
      var next = prev + prev * (Math.random() - 0.5) * 0.00018;
      var delta = ((next - ASSETS[s].base) / ASSETS[s].base) * 100;
      ingestTick(s, next, delta);
    });
  }, 2000);
}

/* ---------------- ASSET TAB SWITCHING ---------------- */
var TAB_IDLE = 'asset-tab px-3 py-1 border border-gridline text-slate-500 rounded-sm hover:text-neoncyan hover:border-neoncyan/40';
var TAB_IDLE_FX = 'asset-tab px-3 py-1 border border-gridline text-slate-500 rounded-sm hover:text-neonamber hover:border-neonamber/40';
var TAB_ACTIVE = 'asset-tab px-3 py-1 border border-neoncyan text-neoncyan bg-neoncyan/10 rounded-sm';
var TAB_ACTIVE_FX = 'asset-tab px-3 py-1 border border-neonamber text-neonamber bg-neonamber/10 rounded-sm';

el.tabs.forEach(function (btn) {
  btn.addEventListener('click', function () {
    var symbol = btn.getAttribute('data-asset');
    if (!ASSETS[symbol]) return;
    state.active = symbol;
    el.tabs.forEach(function (b) {
      var s = b.getAttribute('data-asset');
      var isFx = ASSETS[s].type === 'forex';
      var isActive = s === symbol;
      b.className = isActive ? (isFx ? TAB_ACTIVE_FX : TAB_ACTIVE) : (isFx ? TAB_IDLE_FX : TAB_IDLE);
      b.setAttribute('aria-selected', String(isActive));
    });
    renderActive();
  });
});
