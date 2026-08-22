'use strict';
/* OmniTradeX // TradingView Lightweight Charts adapter */
(function () {
  var chart = null, candles = null, volume = null, container = document.getElementById('tv-chart');
  var resizeObserver = null;
  var bootstrapToken = 0;
  var candleMap = {};
  var interval = '1m';
  var allowedIntervals = { '1m': true, '5m': true, '15m': true, '1h': true, '4h': true };
  function ensureLibrary(done) {
    if (window.LightweightCharts) return done();
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/lightweight-charts@5.2.1/dist/lightweight-charts.standalone.production.js';
    s.onload = done; s.onerror = function () { var e = document.getElementById('chart-error'); if (e) e.textContent = 'Chart library unavailable — live quote feed remains active.'; };
    document.head.appendChild(s);
  }
  function init() {
    if (!container || chart || !window.LightweightCharts) return;
    chart = LightweightCharts.createChart(container, { layout: { background: { color: '#080d15' }, textColor: '#7f8da3' }, grid: { vertLines: { color: '#182232' }, horzLines: { color: '#182232' } }, rightPriceScale: { borderColor: '#27364c' }, timeScale: { borderColor: '#27364c', timeVisible: true, secondsVisible: false }, crosshair: { mode: 0 } });
    // Lightweight Charts v5 uses addSeries(); legacy addCandlestickSeries() was removed.
    candles = chart.addSeries(LightweightCharts.CandlestickSeries, { upColor: '#42d392', downColor: '#ed6a7a', borderVisible: false, wickUpColor: '#42d392', wickDownColor: '#ed6a7a', priceLineVisible: true });
    volume = chart.addSeries(LightweightCharts.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '', priceScale: { scaleMargins: { top: 0.82, bottom: 0 } } });
    resize();
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    } else window.addEventListener('resize', resize);
    document.querySelectorAll('[data-chart-interval]').forEach(function (b) { b.addEventListener('click', function () { interval = b.dataset.chartInterval; document.querySelectorAll('[data-chart-interval]').forEach(function (x) { x.classList.toggle('chart-control-active', x === b); }); bootstrap(); }); });
    bootstrap();
  }
  function resize() { if (chart && container) chart.applyOptions({ width: container.clientWidth, height: Math.max(280, container.clientHeight) }); }
  function bootstrap() {
    if (!candles || !state.active) return;
    var requestToken = ++bootstrapToken;
    var symbol = state.active;
    var crypto = /USDT$/.test(symbol);
    if (!crypto) { var forexMsg = document.getElementById('chart-error'); if (forexMsg) forexMsg.textContent = 'Candles unavailable for this asset: Binance provides crypto klines only.'; return; }
    var errorMsg = document.getElementById('chart-error'); if (errorMsg) errorMsg.textContent = 'Loading Binance ' + interval + ' klines…';
    fetch('https://api.binance.com/api/v3/klines?symbol=' + encodeURIComponent(symbol) + '&interval=' + encodeURIComponent(interval) + '&limit=300', { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (rows) {
        if (requestToken !== bootstrapToken) return;
        if (!Array.isArray(rows) || rows.length < 2) throw new Error('No valid klines');
        var data = [], vol = [];
        rows.forEach(function (row) {
          if (!Array.isArray(row) || row.length < 6) return;
          var item = { time: Math.floor(Number(row[0]) / 1000), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]) };
          var v = Number(row[5]);
          if (Object.values(item).some(function (x) { return !Number.isFinite(x); }) || !Number.isFinite(v)) return;
          data.push(item); vol.push({ time: item.time, value: v, color: item.close >= item.open ? 'rgba(66,211,146,.45)' : 'rgba(237,106,122,.45)' });
        });
        candleMap = {}; data.forEach(function (x) { candleMap[x.time] = x; }); candles.setData(data); volume.setData(vol); candles.priceScale().applyOptions({ autoScale: true });
        if (errorMsg) errorMsg.textContent = 'BINANCE KLINES // ' + data.length + ' REAL CANDLES // ' + interval;
      })
      .catch(function (err) { if (errorMsg) errorMsg.textContent = 'Binance klines unavailable (' + err.message + '). Live ticker remains active.'; });
  }
  window.chartOnTick = function (tick) {
    if (!candles || tick.symbol !== state.active) return;
    var intervalSeconds = Math.max(60, parseInt(interval, 10) || 1) * 60;
    var time = Math.floor(tick.eventAt / (intervalSeconds * 1000)) * intervalSeconds;
    var prior = candleMap[time] || { time: time, open: tick.price, high: tick.price, low: tick.price, close: tick.price };
    prior.close = tick.price; prior.high = Math.max(prior.high, tick.price); prior.low = Math.min(prior.low, tick.price); candleMap[time] = prior; candles.update(prior);
  };
  window.otxCharts = { init: function () { ensureLibrary(init); }, bootstrap: bootstrap };
}());
