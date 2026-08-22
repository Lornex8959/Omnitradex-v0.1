'use strict';
/* OmniTradeX // optional official TradingView widget, isolated from private data */
(function () {
  var host = document.getElementById('tradingview-widget');
  var loaded = false;
  window.otxTradingView = {
    mount: function () {
      if (!host || loaded) return;
      loaded = true;
      var script = document.createElement('script'); script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'; script.async = true;
      script.textContent = JSON.stringify({ autosize: true, symbol: 'BINANCE:BTCUSDT', interval: '1', timezone: 'Etc/UTC', theme: 'dark', style: '1', locale: 'en', allow_symbol_change: true, hide_top_toolbar: false, hide_legend: false, save_image: false });
      host.appendChild(script);
    }
  };
}());
