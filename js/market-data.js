'use strict';
/* OmniTradeX // normalized public market-data adapter */
(function () {
  var endpoints = [
    'wss://stream.binance.com:9443/stream?streams=',
    'wss://stream.binance.us:9443/stream?streams='
  ];
  var streams = 'btcusdt@ticker/ethusdt@ticker/solusdt@ticker/xrpusdt@ticker/bnbusdt@ticker/dogeusdt@ticker';
  var attempt = 0;
  var retryTimer = null;
  var watchdogTimer = null;
  var opened = false;
  var lastEvent = 0;
  var requested = false;
  var stopped = false;
  var socketGeneration = 0;

  function setSource(status, cls) {
    if (typeof setFeed === 'function') setFeed(status, cls || 'text-slate-500');
    var badge = document.getElementById('market-source');
    if (badge) badge.textContent = status === 'LIVE' ? 'BINANCE PUBLIC // LIVE' : 'BINANCE PUBLIC // ' + status;
    var dot = document.getElementById('market-status-dot');
    if (dot) dot.className = 'inline-block h-1.5 w-1.5 rounded-full mr-1.5 ' + (status === 'LIVE' ? 'bg-neongreen' : status === 'STALE' ? 'bg-neonred' : 'bg-neonamber');
    window.dispatchEvent(new CustomEvent('otx:market-status', { detail: { status: status, source: 'binance-public' } }));
  }

  function parseTicker(raw) {
    var t = raw && raw.data ? raw.data : raw;
    if (!t || !ASSETS[t.s]) return null;
    var price = Number(t.c), delta = Number(t.P);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(delta)) return null;
    return { symbol: t.s, price: price, delta: delta, eventAt: Number(t.E) || Date.now(), source: 'binance-public' };
  }

  function connect() {
    if (stopped || retryTimer || state.ws || !window.WebSocket) return;
    setSource('CONNECTING', 'text-neonamber');
    var generation = ++socketGeneration;
    var ws;
    try { ws = new WebSocket(endpoints[attempt % endpoints.length] + streams); } catch (e) { schedule(); return; }
    state.ws = ws;
    opened = false;
    ws.onopen = function () {
      if (generation !== socketGeneration || stopped) { try { ws.close(); } catch (e) {} return; }
      opened = true; attempt = 0; lastEvent = Date.now(); state.lastTickAt = lastEvent;
      setSource('LIVE', 'text-neongreen');
    };
    ws.onmessage = function (event) {
      if (generation !== socketGeneration || stopped) return;
      var tick = null;
      try { tick = parseTicker(JSON.parse(event.data)); } catch (e) { return; }
      if (!tick) return;
      lastEvent = Date.now(); state.lastTickAt = lastEvent;
      state.source = 'binance-public'; state.marketMode = 'LIVE';
      if (el.hudLatency) el.hudLatency.textContent = Math.max(0, Math.min(9999, Date.now() - tick.eventAt)) + ' ms';
      ingestTick(tick.symbol, tick.price, tick.delta);
      if (typeof chartOnTick === 'function') chartOnTick(tick);
    };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
    ws.onclose = function () {
      if (generation !== socketGeneration || stopped) return;
      if (state.ws === ws) state.ws = null;
      if (!opened) attempt++;
      setSource('RECONNECTING', 'text-neonamber');
      schedule();
    };
  }
  function schedule() {
    if (retryTimer) return;
    var base = Math.min(30000, 1000 * Math.pow(2, Math.min(5, attempt)));
    var delay = Math.round(base * (0.8 + Math.random() * 0.4));
    retryTimer = setTimeout(function () { retryTimer = null; connect(); }, delay);
  }
  setInterval(function () {
    if (state.marketMode === 'LIVE' && lastEvent && Date.now() - lastEvent > 30000) {
      state.marketMode = 'STALE'; setSource('STALE', 'text-neonred');
      try { if (state.ws) state.ws.close(); } catch (e) {}
    }
  }, 5000);
  window.addEventListener('beforeunload', function () { if (state.ws) state.ws.close(); });
  function stop() {
    stopped = true;
    socketGeneration++;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (state.ws) { try { state.ws.close(); } catch (e) {} state.ws = null; }
    setSource('OFFLINE', 'text-slate-500');
  }
  function resume() { stopped = false; requested = true; connect(); }
  window.otxMarket = { connect: connect, stop: stop, resume: resume, status: function () { return { mode: state.marketMode || 'UNKNOWN', lastEvent: lastEvent, ageMs: lastEvent ? Date.now() - lastEvent : null }; } };
  window.connectBinance = function () { if (!requested) { requested = true; connect(); } };
}());

