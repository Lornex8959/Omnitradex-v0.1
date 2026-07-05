'use strict';
/* OmniTradeX Engine // module: intel — load order matters, see index.html */

/* ================================================================
   PHASE 6 // MODULE 4: GLOBAL INTEL — NEWS, EVENTS & IMPACT FORECASTS
   World events feed (live wire via Finnhub key, simulated fallback),
   deterministic impact classification per headline, and on-demand
   AI future-impact predictions via the active premium engine.
   ================================================================ */
var newsItems = [];
var newsFilter = 'all';

var SIM_NEWS = [
  { cat: 'macro', src: 'FED WIRE', headline: 'Federal Reserve signals two rate cuts by Q4 as core inflation cools to 2.4%', tickers: ['SPY', 'QQQ', 'TLT'] },
  { cat: 'macro', src: 'ECB DESK', headline: 'ECB holds rates steady; Lagarde warns of persistent services inflation in eurozone', tickers: ['EURUSD', 'DAX'] },
  { cat: 'equities', src: 'EARNINGS', headline: 'NVIDIA beats estimates with record data-center revenue, raises full-year guidance', tickers: ['NVDA', 'AMD', 'TSM'] },
  { cat: 'equities', src: 'EARNINGS', headline: 'Apple iPhone shipments miss in China as local competition intensifies', tickers: ['AAPL', 'QQQ'] },
  { cat: 'equities', src: 'M&A DESK', headline: 'Microsoft announces $40B expansion of AI infrastructure capex through 2027', tickers: ['MSFT', 'NVDA', 'AVGO'] },
  { cat: 'crypto', src: 'CHAIN WIRE', headline: 'Spot Bitcoin ETFs record largest weekly inflow since launch; exchange reserves hit 5-year low', tickers: ['BTCUSDT', 'COIN', 'MSTR'] },
  { cat: 'crypto', src: 'CHAIN WIRE', headline: 'Ethereum staking yield compresses as validator queue clears; L2 activity at all-time high', tickers: ['ETHUSDT', 'SOLUSDT'] },
  { cat: 'crypto', src: 'REG WATCH', headline: 'SEC delays decision on multi-asset crypto index ETF amid custody concerns', tickers: ['BTCUSDT', 'ETHUSDT', 'COIN'] },
  { cat: 'forex', src: 'FX DESK', headline: 'Bank of Japan intervention alert: USD/JPY breaches defense zone as yields diverge', tickers: ['USDJPY', 'DXY'] },
  { cat: 'forex', src: 'FX DESK', headline: 'Sterling rallies on stronger UK wage growth; BoE cut bets pushed to next quarter', tickers: ['GBPUSD', 'FTSE'] },
  { cat: 'geopolitics', src: 'GEO INTEL', headline: 'Middle East shipping disruption escalates; Brent crude spikes above key resistance', tickers: ['BRENT', 'XOM', 'USO'] },
  { cat: 'geopolitics', src: 'GEO INTEL', headline: 'New semiconductor export controls announced targeting advanced AI chips', tickers: ['NVDA', 'ASML', 'TSM'] },
  { cat: 'macro', src: 'DATA WIRE', headline: 'US CPI print hotter than expected at 3.1% YoY; rate cut odds repriced sharply lower', tickers: ['SPY', 'TLT', 'DXY'] },
  { cat: 'equities', src: 'AUTO DESK', headline: 'Tesla unveils lower-cost platform; delivery guidance revised upward for next year', tickers: ['TSLA', 'RIVN'] },
  { cat: 'geopolitics', src: 'GEO INTEL', headline: 'Major economies agree on critical minerals supply pact, easing battery metal concerns', tickers: ['ALB', 'LIT', 'TSLA'] }
];

/* Deterministic impact classifier: keyword vectors -> direction + magnitude + rationale */
var IMPACT_RULES = [
  { re: /rate cut|cuts by|dovish|inflation cools|yield compress/i, dir: 'BULLISH', mag: 2, note: 'Easier policy expectations lift risk assets; long-duration and growth names benefit most.' },
  { re: /hotter than expected|holds rates|persistent .*inflation|repriced .*lower|hawkish/i, dir: 'BEARISH', mag: 2, note: 'Sticky inflation delays easing; pressure on equities and long bonds, USD supported.' },
  { re: /beats estimates|record .*revenue|raises .*guidance|revised upward|rallies|inflow/i, dir: 'BULLISH', mag: 3, note: 'Positive surprise vs consensus; expect momentum continuation and sector sympathy moves.' },
  { re: /miss|delays decision|concerns|disruption|controls|breaches defense/i, dir: 'BEARISH', mag: 2, note: 'Negative catalyst; expect de-risking in affected names and elevated implied volatility.' },
  { re: /spikes|escalates|intervention/i, dir: 'VOLATILE', mag: 3, note: 'Event risk regime: two-sided liquidation risk, widen stops or stand aside intraday.' },
  { re: /pact|agree|easing .*concerns|clears/i, dir: 'BULLISH', mag: 1, note: 'Risk-reducing development; supportive but mostly priced over days, not minutes.' }
];

function analyzeImpact(headline) {
  for (var i = 0; i < IMPACT_RULES.length; i++) {
    if (IMPACT_RULES[i].re.test(headline)) return IMPACT_RULES[i];
  }
  return { dir: 'NEUTRAL', mag: 1, note: 'No dominant directional keyword vector; monitor price reaction for confirmation.' };
}

var IMPACT_CLS = {
  BULLISH: 'border-neongreen/50 text-neongreen',
  BEARISH: 'border-neonred/50 text-neonred',
  VOLATILE: 'border-neonamber/50 text-neonamber',
  NEUTRAL: 'border-gridline text-slate-500'
};

function updateRadar() {
  var buckets = { equities: [], crypto: [], forex: [], commod: [] };
  newsItems.forEach(function (n) {
    var imp = n.impact;
    var score = imp.dir === 'BULLISH' ? imp.mag : imp.dir === 'BEARISH' ? -imp.mag : 0;
    if (n.cat === 'crypto') buckets.crypto.push(score);
    else if (n.cat === 'forex') buckets.forex.push(score);
    else if (n.cat === 'geopolitics') buckets.commod.push(score);
    else buckets.equities.push(score);
  });
  [['radar-equities', 'EQUITIES', buckets.equities],
   ['radar-crypto', 'CRYPTO', buckets.crypto],
   ['radar-forex', 'FOREX', buckets.forex],
   ['radar-commod', 'COMMODITIES', buckets.commod]].forEach(function (row) {
    var elx = document.getElementById(row[0]);
    var sum = row[2].reduce(function (a, b) { return a + b; }, 0);
    var mood = row[2].length === 0 ? '--' : sum > 1 ? 'RISK-ON' : sum < -1 ? 'RISK-OFF' : 'MIXED';
    elx.textContent = row[1] + ' ' + mood;
    elx.className = 'border rounded-sm px-3 py-1.5 ' +
      (mood === 'RISK-ON' ? 'border-neongreen/50 text-neongreen' :
       mood === 'RISK-OFF' ? 'border-neonred/50 text-neonred' :
       mood === 'MIXED' ? 'border-neonamber/50 text-neonamber' : 'border-gridline text-slate-500');
  });
}

function newsCard(item, idx) {
  var card = document.createElement('article');
  card.className = 'neon-panel rounded-sm p-4 flex flex-col gap-2 font-techmono text-[11px]';

  var top = document.createElement('div');
  top.className = 'flex items-center gap-2';
  var catBadge = document.createElement('span');
  catBadge.className = 'border border-gridline text-slate-500 text-[9px] px-1.5 py-0.5 rounded-sm uppercase';
  catBadge.textContent = item.cat;
  var srcSpan = document.createElement('span');
  srcSpan.className = 'text-slate-600 text-[10px]';
  srcSpan.textContent = item.src + ' // ' + item.time;
  var impBadge = document.createElement('span');
  impBadge.className = 'ml-auto border text-[9px] px-1.5 py-0.5 rounded-sm uppercase font-semibold ' + IMPACT_CLS[item.impact.dir];
  impBadge.textContent = item.impact.dir + ' ' + '\u25CF'.repeat(item.impact.mag);
  top.appendChild(catBadge); top.appendChild(srcSpan); top.appendChild(impBadge);
  card.appendChild(top);

  var h = document.createElement('h3');
  h.className = 'font-inter text-xs font-semibold text-slate-200 leading-relaxed text-pretty';
  h.textContent = item.headline;
  card.appendChild(h);

  var chips = document.createElement('div');
  chips.className = 'flex flex-wrap gap-1';
  item.tickers.forEach(function (t) {
    var c = document.createElement('span');
    c.className = 'border border-neoncyan/30 text-neoncyan text-[9px] px-1.5 py-0.5 rounded-sm';
    c.textContent = t;
    chips.appendChild(c);
  });
  card.appendChild(chips);

  var note = document.createElement('p');
  note.className = 'text-slate-500 leading-relaxed';
  note.textContent = item.impact.note;
  card.appendChild(note);

  var fcBox = document.createElement('div');
  fcBox.className = 'hidden border-t border-neonmagenta/20 pt-2 font-inter text-[11px] leading-relaxed text-slate-300';
  fcBox.setAttribute('aria-live', 'polite');

  var btn = document.createElement('button');
  btn.className = 'btn-neon btn-neon-magenta font-orbitron text-[9px] tracking-widest text-neonmagenta rounded-sm px-3 py-1.5 uppercase self-start';
  btn.textContent = 'AI Impact Forecast';
  btn.addEventListener('click', function () { forecastNews(item, fcBox, btn); });
  card.appendChild(btn);
  card.appendChild(fcBox);
  return card;
}

function forecastNews(item, box, btn) {
  box.classList.remove('hidden');
  if (!modelKey()) {
    box.textContent = 'Local model: ' + item.impact.dir + ' impact (' + item.impact.mag + '/3) on ' +
      item.tickers.join(', ') + '. ' + item.impact.note + ' Add a premium key in the Key Vault for a full AI forecast.';
    return;
  }
  btn.disabled = true;
  btn.classList.add('opacity-50');
  box.textContent = 'Forecasting with ' + activeModel().label + '...';
  callModel({
    systemInstruction:
      'You are QUANTUM CORE v3 GLOBAL INTEL, an elite macro strategist. In max 90 words of markdown: ' +
      'state the likely market impact of the given news over the next 1-4 weeks — direction, magnitude, the most affected listed companies/assets, ' +
      'second-order effects, and one contrarian risk to the consensus read.',
    userQuery: 'NEWS EVENT: ' + item.headline + '\nCATEGORY: ' + item.cat +
      '\nAFFECTED TICKERS: ' + item.tickers.join(', ') +
      '\nDETERMINISTIC READ: ' + item.impact.dir + ' magnitude ' + item.impact.mag + '/3.'
  }).then(function (text) {
    renderMarkdown(box, text);
  }).catch(function (err) {
    box.textContent = 'Forecast uplink failed: ' + err.message;
  }).finally(function () {
    btn.disabled = false;
    btn.classList.remove('opacity-50');
  });
}

function renderNews() {
  var grid = document.getElementById('news-grid');
  grid.innerHTML = '';
  var shown = newsItems.filter(function (n) { return newsFilter === 'all' || n.cat === newsFilter; });
  if (!shown.length) {
    var empty = document.createElement('p');
    empty.className = 'font-techmono text-[11px] text-slate-600 col-span-full';
    empty.textContent = 'No intel in this channel yet. Trigger a sweep.';
    grid.appendChild(empty);
    return;
  }
  shown.forEach(function (item, idx) { grid.appendChild(newsCard(item, idx)); });
  updateRadar();
}

function loadSimNews() {
  var pool = SIM_NEWS.slice().sort(function () { return Math.random() - 0.5; });
  newsItems = pool.slice(0, 12).map(function (n) {
    return {
      cat: n.cat, src: n.src, headline: n.headline, tickers: n.tickers,
      time: new Date(Date.now() - Math.random() * 6 * 3600000).toISOString().slice(11, 16) + 'Z',
      impact: analyzeImpact(n.headline)
    };
  });
  document.getElementById('news-source-badge').textContent = 'Feed: Simulated';
  renderNews();
}

function classifyFinnhubCategory(fnCat, headline) {
  if (fnCat === 'crypto') return 'crypto';
  if (fnCat === 'forex') return 'forex';
  if (/war|sanction|election|geopolit|military|tariff/i.test(headline)) return 'geopolitics';
  if (/fed|inflation|cpi|gdp|rates|central bank|treasury/i.test(headline)) return 'macro';
  return 'equities';
}

function refreshNews() {
  var fk = getSlot('finnhub');
  if (!fk) { loadSimNews(); return; }
  document.getElementById('news-source-badge').textContent = 'Feed: Finnhub Live';
  Promise.all(['general', 'crypto', 'forex'].map(function (cat) {
    return fetch('https://finnhub.io/api/v1/news?category=' + cat + '&token=' + encodeURIComponent(fk))
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (arr) { return arr.slice(0, 6).map(function (n) { n._fnCat = cat; return n; }); })
      .catch(function () { return []; });
  })).then(function (groups) {
    var flat = groups[0].concat(groups[1], groups[2]);
    if (!flat.length) { loadSimNews(); return; }
    newsItems = flat.map(function (n) {
      var headline = n.headline || n.summary || 'Untitled wire item';
      return {
        cat: classifyFinnhubCategory(n._fnCat, headline),
        src: (n.source || 'WIRE').toUpperCase(),
        headline: headline,
        tickers: n.related ? String(n.related).split(',').filter(Boolean).slice(0, 4) : [],
        time: n.datetime ? new Date(n.datetime * 1000).toISOString().slice(11, 16) + 'Z' : '--:--',
        impact: analyzeImpact(headline)
      };
    }).slice(0, 18);
    renderNews();
  });
}
window.refreshNews = refreshNews;

document.getElementById('btn-news-refresh').addEventListener('click', refreshNews);

/* News category filter tabs */
Array.prototype.forEach.call(document.querySelectorAll('.news-cat'), function (tab) {
  tab.addEventListener('click', function () {
    newsFilter = tab.getAttribute('data-newscat');
    document.querySelectorAll('.news-cat').forEach(function (t) {
      var on = t === tab;
      t.className = 'news-cat px-3 py-1.5 border rounded-sm uppercase ' +
        (on ? 'border-neonamber text-neonamber bg-neonamber/10' : 'border-gridline text-slate-500 hover:text-neonamber hover:border-neonamber/40');
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    renderNews();
  });
});
