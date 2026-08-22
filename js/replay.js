'use strict';
/* OmniTradeX Engine // module: replay — load order matters, see index.html */

/* ================================================================
   PHASE 9 // MODULE 4: BACKTEST REPLAY ENGINE — TIME MACHINE
   Replays the session tick tape for the active asset through an
   SMA 8/21 crossover model with play / scrub / speed transport.
   ================================================================ */
var replay = { data: [], idx: 0, playing: false, timer: null, trades: [], symbol: '' };
var rc = document.getElementById('replay-canvas');
var rWrap = document.getElementById('replay-wrap');
var rCtx = rc.getContext('2d');

function sizeReplayCanvas() {
  var dpr = window.devicePixelRatio || 1;
  var r = rWrap.getBoundingClientRect();
  if (!r.width || !r.height) return;
  rc.width = Math.max(1, Math.floor(r.width * dpr));
  rc.height = Math.max(1, Math.floor(r.height * dpr));
  rCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', function () {
  if (!VIEWS || !VIEWS.replay || VIEWS.replay.el.classList.contains('hidden')) return;
  sizeReplayCanvas();
  drawReplay();
});

function sma(arr, i, n) {
  if (i + 1 < n) return null;
  var sum = 0;
  for (var k = i - n + 1; k <= i; k++) sum += arr[k];
  return sum / n;
}

function backtestTape(data) {
  // SMA 8/21 crossover: flip position on each cross, tally closed trades
  var trades = [];
  var pos = null;
  for (var i = 21; i < data.length; i++) {
    var fPrev = sma(data, i - 1, 8), sPrev = sma(data, i - 1, 21);
    var fNow = sma(data, i, 8), sNow = sma(data, i, 21);
    if (fPrev == null || sPrev == null) continue;
    var crossUp = fPrev <= sPrev && fNow > sNow;
    var crossDn = fPrev >= sPrev && fNow < sNow;
    if (!crossUp && !crossDn) continue;
    var dir = crossUp ? 1 : -1;
    if (pos && pos.dir !== dir) {
      pos.exitIdx = i;
      pos.pnlPct = ((data[i] - data[pos.entryIdx]) / data[pos.entryIdx]) * 100 * pos.dir;
      trades.push(pos);
      pos = null;
    }
    if (!pos) pos = { dir: dir, entryIdx: i, exitIdx: null, pnlPct: null };
  }
  return trades;
}

function replaySetStatus(text, cls) {
  var el9 = document.getElementById('replay-status');
  el9.textContent = text;
  el9.className = 'font-techmono text-[10px] ' + (cls || 'text-slate-500');
}

function replayLoad() {
  var sym = state.active;
  var tape = (state.tape && state.tape[sym]) || [];
  if (tape.length < 40) {
    replaySetStatus('TAPE // TOO SHORT (' + tape.length + ' ticks)', 'text-neonamber');
    aiPrint('> REPLAY: only ' + tape.length + ' ticks taped for ' + ASSETS[sym].label + '. Leave the Terminal running a bit longer, then reload the tape.', 'text-neonamber');
    return;
  }
  replayStop();
  replay.data = tape.slice();
  replay.symbol = sym;
  replay.trades = backtestTape(replay.data);
  replay.idx = 22;
  var scrub = document.getElementById('replay-scrub');
  scrub.max = String(replay.data.length - 1);
  scrub.value = String(replay.idx);
  var standby = document.getElementById('replay-standby');
  if (standby) standby.style.display = 'none';
  sizeReplayCanvas();
  replaySetStatus('TAPE // ' + ASSETS[sym].label + ' — ' + replay.data.length + ' TICKS', 'text-neonamber');
  drawReplay();
}

function replayStop() {
  replay.playing = false;
  if (replay.timer) { clearInterval(replay.timer); replay.timer = null; }
  document.getElementById('replay-play-icon').className = 'fa-solid fa-play mr-1.5';
  document.getElementById('replay-play-label').textContent = 'Play';
}

function replayTogglePlay() {
  if (!replay.data.length) { replayLoad(); if (!replay.data.length) return; }
  if (replay.playing) { replayStop(); return; }
  if (replay.idx >= replay.data.length - 1) replay.idx = 22; // rewind at end
  replay.playing = true;
  document.getElementById('replay-play-icon').className = 'fa-solid fa-pause mr-1.5';
  document.getElementById('replay-play-label').textContent = 'Pause';
  replay.timer = setInterval(function () {
    var speed = parseInt(document.getElementById('replay-speed').value, 10) || 1;
    replay.idx = Math.min(replay.idx + speed, replay.data.length - 1);
    document.getElementById('replay-scrub').value = String(replay.idx);
    drawReplay();
    if (replay.idx >= replay.data.length - 1) {
      replayStop();
      replaySetStatus('TAPE // REPLAY COMPLETE', 'text-neongreen');
    }
  }, 90);
}

function drawReplay() {
  if (!replay.data.length) return;
  var data = replay.data;
  var idx = replay.idx;
  var w = rc.width / (window.devicePixelRatio || 1);
  var h = rc.height / (window.devicePixelRatio || 1);
  rCtx.clearRect(0, 0, w, h);

  // grid
  rCtx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
  rCtx.lineWidth = 1;
  for (var gx = 0; gx <= w; gx += 34) { rCtx.beginPath(); rCtx.moveTo(gx, 0); rCtx.lineTo(gx, h); rCtx.stroke(); }
  for (var gy = 0; gy <= h; gy += 26) { rCtx.beginPath(); rCtx.moveTo(0, gy); rCtx.lineTo(w, gy); rCtx.stroke(); }

  var slice = data.slice(0, idx + 1);
  var min = Math.min.apply(null, data);
  var max = Math.max.apply(null, data);
  var range = (max - min) || (min * 0.0005) || 1;
  var padY = 14;
  var span = Math.max(data.length - 1, 1);
  function px(i) { return (i / span) * w; }
  function py(v) { return h - padY - ((v - min) / range) * (h - padY * 2); }

  // price line up to the playhead
  rCtx.save();
  rCtx.shadowColor = 'rgba(251,191,36,0.7)';
  rCtx.shadowBlur = 8;
  rCtx.strokeStyle = '#fbbf24';
  rCtx.lineWidth = 1.6;
  rCtx.lineJoin = 'round';
  rCtx.beginPath();
  rCtx.moveTo(px(0), py(slice[0]));
  for (var i = 1; i < slice.length; i++) rCtx.lineTo(px(i), py(slice[i]));
  rCtx.stroke();
  rCtx.restore();

  // trade markers already revealed by the playhead
  var closed = 0, wins = 0, pnl = 0;
  replay.trades.forEach(function (t) {
    if (t.entryIdx <= idx) {
      rCtx.beginPath();
      rCtx.arc(px(t.entryIdx), py(data[t.entryIdx]), 3.5, 0, Math.PI * 2);
      rCtx.fillStyle = t.dir === 1 ? '#4ade80' : '#f87171';
      rCtx.fill();
    }
    if (t.exitIdx != null && t.exitIdx <= idx) {
      closed++;
      if (t.pnlPct >= 0) wins++;
      pnl += t.pnlPct;
      rCtx.beginPath();
      rCtx.arc(px(t.exitIdx), py(data[t.exitIdx]), 2.5, 0, Math.PI * 2);
      rCtx.strokeStyle = '#22d3ee';
      rCtx.lineWidth = 1.4;
      rCtx.stroke();
    }
  });

  // playhead beacon
  rCtx.beginPath();
  rCtx.arc(px(idx), py(data[idx]), 4, 0, Math.PI * 2);
  rCtx.fillStyle = '#22d3ee';
  rCtx.shadowColor = 'rgba(34,211,238,0.9)';
  rCtx.shadowBlur = 8;
  rCtx.fill();
  rCtx.shadowBlur = 0;

  // stats readout
  document.getElementById('replay-pos').textContent = 'TICK ' + idx + ' / ' + (data.length - 1);
  document.getElementById('replay-trades').textContent = String(closed);
  document.getElementById('replay-winrate').textContent = closed ? Math.round((wins / closed) * 100) + '%' : '--%';
  var pnlEl9 = document.getElementById('replay-pnl');
  pnlEl9.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + '%';
  pnlEl9.className = 'font-orbitron text-sm ' + (pnl >= 0 ? 'text-neongreen' : 'text-neonred');
}

document.getElementById('replay-load').addEventListener('click', replayLoad);
document.getElementById('replay-play').addEventListener('click', replayTogglePlay);
document.getElementById('replay-scrub').addEventListener('input', function () {
  if (!replay.data.length) return;
  replayStop();
  replay.idx = Math.max(22, parseInt(this.value, 10) || 22);
  drawReplay();
});
