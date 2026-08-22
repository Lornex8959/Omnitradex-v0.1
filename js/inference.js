'use strict';
/* OmniTradeX Engine // module: inference — load order matters, see index.html */

/* ================================================================
   PHASE 6 // LIVE MULTI-MODEL INFERENCE
   Provider adapters route the payload to the OFFICIAL endpoint of
   the selected premium engine, with exponential backoff retries.
   ================================================================ */
function providerRequestFor(m, key, payload) {
  if (m.provider === 'gemini') {
    return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m.model + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: payload.systemInstruction }] },
        contents: [{ parts: [{ text: payload.userQuery }] }]
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      var text = json.candidates && json.candidates[0] &&
        json.candidates[0].content && json.candidates[0].content.parts &&
        json.candidates[0].content.parts[0].text;
      if (!text) throw new Error('Empty inference payload');
      return text;
    });
  }
  if (m.provider === 'anthropic') {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: m.model,
        max_tokens: 800,
        system: payload.systemInstruction,
        messages: [{ role: 'user', content: payload.userQuery }]
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      var text = json.content && json.content[0] && json.content[0].text;
      if (!text) throw new Error('Empty inference payload');
      return text;
    });
  }
  // openai + groq share the OpenAI-compatible chat completions shape
  var url = m.provider === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({
      model: m.model,
      max_tokens: 800,
      messages: [
        { role: 'system', content: payload.systemInstruction },
        { role: 'user', content: payload.userQuery }
      ]
    })
  }).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }).then(function (json) {
    var text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    if (!text) throw new Error('Empty inference payload');
    return text;
  });
}

// default path: route to the pilot's active engine (Phase 9 consensus calls providerRequestFor directly)
function providerRequest(payload) { return providerRequestFor(activeModel(), modelKey(), payload); }

function callModel(payload, attempt) {
  attempt = attempt || 0;
  return providerRequest(payload).catch(function (err) {
    if (attempt >= 3) throw err;
    var delay = Math.pow(2, attempt) * 1000;
    aiPrint('> Uplink retry in ' + (delay / 1000) + 's (' + err.message + ')...', 'text-neonamber');
    return new Promise(function (resolve) { setTimeout(resolve, delay); })
      .then(function () { return callModel(payload, attempt + 1); });
  });
}
var callGemini = callModel; // legacy alias — routes through the active engine

function extractMemory(fullText) {
  var m = fullText.match(/MEMORY:\s*(.+)$/im);
  if (m) return m[1].trim();
  // fallback: first sentence (no lookbehind — Safari < 16.4 compatibility)
  var sentence = fullText.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (sentence ? sentence[0] : fullText).slice(0, 200);
}

/* Minimal markdown -> safe DOM parser (bold, italics, bullets, headings) */
function renderMarkdown(container, text) {
  container.innerHTML = '';
  text.split('\n').forEach(function (rawLine) {
    var line = rawLine.trim();
    if (!line) return;
    var p = document.createElement('p');
    var isBullet = /^[-*]\s+/.test(line);
    var isHeading = /^#{1,4}\s+/.test(line);
    if (isBullet) { line = line.replace(/^[-*]\s+/, ''); p.className = 'pl-3 relative before:content-["\u25B8"] before:absolute before:left-0 before:text-neonmagenta'; }
    if (isHeading) { line = line.replace(/^#{1,4}\s+/, ''); p.className = 'font-orbitron text-neonmagenta uppercase text-[11px] tracking-widest mt-1'; }
    if (/^MEMORY:/i.test(line)) p.className = 'text-neonmagenta/80 border-t border-neonmagenta/20 pt-1.5 mt-1.5';
    // tokenize **bold** and *italic* safely via textContent nodes
    var parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    parts.forEach(function (part) {
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        var b = document.createElement('strong');
        b.className = 'text-slate-100 font-semibold';
        b.textContent = part.slice(2, -2);
        p.appendChild(b);
      } else if (/^\*[^*]+\*$/.test(part)) {
        var em = document.createElement('em');
        em.textContent = part.slice(1, -1);
        p.appendChild(em);
      } else if (part) {
        p.appendChild(document.createTextNode(part));
      }
    });
    container.appendChild(p);
  });
}

function setLoader(on) {
  el.loader.style.display = on ? 'block' : 'none';
  var label = activeModel().label;
  el.aiStatus.textContent = on ? label + ' // INFERRING' : label + ' // ' + (modelKey() ? 'ARMED' : 'STANDBY');
  el.aiStatus.className = 'font-techmono text-[10px] ' + (on ? 'text-neonmagenta glow-magenta' : 'text-slate-500');
}

/* ============ PHASE 4 CORE: triggerCoreAIInference() ============ */
var aiBusy = false;
var lastInferenceAt = 0;
var INFERENCE_COOLDOWN = 10000; // respectful rate limiting: min 10s between API calls

function triggerCoreAIInference() {
  if (aiBusy) return;
  var since = Date.now() - lastInferenceAt;
  if (since < INFERENCE_COOLDOWN) {
    aiPrint('> Rate limiter: cooldown active. Retry in ' + Math.ceil((INFERENCE_COOLDOWN - since) / 1000) + 's.', 'text-neonamber');
    return;
  }
  lastInferenceAt = Date.now();

  // 1. INFRASTRUCTURE BINDING: scrape active dashboard variables
  var payload = buildPayload();
  aiPrint('> Cognitive inference :: ' + ASSETS[state.active].label + ' :: ' + activeStrategy().toUpperCase(), 'text-neonmagenta glow-magenta');
  aiPrint('> Node scrape: ' + activeWallet(), 'text-slate-500');
  aiPrint('> Memory buffer injected: ' + quantum_memory.length + '/5 past decisions.', 'text-slate-500');

  if (!modelKey()) {
    aiPrint('> NO KEY DECIPHERED for ' + activeModel().label + '. Running local heuristic fallback...', 'text-neonamber');
    var d = state.last[state.active];
    var summary = ASSETS[state.active].label + ' ' + (d.delta >= 0 ? 'bullish' : 'bearish') +
      ' bias at ' + fmtPrice(state.active, d.price) + ' via ' + activeStrategy() + '.';
    el.aiOutput.style.display = 'block';
    renderMarkdown(el.aiOutput,
      '**BIAS: ' + (d.delta >= 0 ? 'LONG' : 'SHORT') + ' (heuristic)**\n' +
      '- ' + summary + '\n' +
      '- Node context: ' + activeWallet() + '\n' +
      '- Honor 2% trail SL / 4% target discipline.\n' +
      'MEMORY: ' + summary);
    pushMemory(summary);
    aiPrint('> Memory ' + quantum_memory.length + '/5 committed to quantum_memory.', 'text-neongreen');
    return;
  }

  // 4. TERMINAL INTERFACE: toggle loader during network request
  aiBusy = true;
  el.aiBtn.disabled = true;
  el.aiBtn.classList.add('opacity-50');
  setLoader(true);
  el.aiOutput.style.display = 'none';

  // 3 + 5. LIVE API INFERENCE with exponential backoff (inside callGemini)
  callGemini(payload).then(function (text) {
    el.aiOutput.style.display = 'block';
    renderMarkdown(el.aiOutput, text);
    // Diagnostic memory summary -> quantum_memory (max 5)
    pushMemory(extractMemory(text));
    aiPrint('> Inference parsed. Memory ' + quantum_memory.length + '/5 committed to quantum_memory.', 'text-neongreen');
  }).catch(function (err) {
    aiPrint('> INFERENCE FAILED: ' + err.message + '. Backoff exhausted.', 'text-neonred');
  }).finally(function () {
    aiBusy = false;
    el.aiBtn.disabled = false;
    el.aiBtn.classList.remove('opacity-50');
    setLoader(false);
  });
}
window.triggerCoreAIInference = triggerCoreAIInference;
el.aiBtn.addEventListener('click', triggerCoreAIInference);

/* ---------------- MACRO WORLD SCRAPER (simulated intel rotation) ---------------- */
var MACRO_FEED = [
  { cat: 'Macro', cls: 'border-neonamber/40 text-neonamber', items: [
    'Fed funds futures reprice: 2 cuts now expected by Q4.',
    'US 10Y yield tests resistance; risk assets watching 4.5% line.',
    'ECB holds rates; Lagarde signals data-dependent path.',
    'BoJ intervention watch: USD/JPY approaching verbal defense zone.',
    'US CPI print due — options implying 1.2% SPX straddle move.'
  ]},
  { cat: 'Crypto', cls: 'border-neoncyan/40 text-neoncyan', items: [
    'BTC ETF net inflows resume after 3-day outflow streak.',
    'Exchange BTC reserves at 5-year low — supply squeeze thesis active.',
    'Large OTC desk reports elevated ETH accumulation blocks.',
    'Funding rates flip positive across major perp venues.',
    'Stablecoin market cap expands — dry powder building.'
  ]},
  { cat: 'Forex', cls: 'border-neonmagenta/40 text-neonmagenta', items: [
    'DXY correlation matrix: inverse BTC coupling strengthens to -0.72.',
    'EUR/USD order block cluster detected at 1.0780-1.0800.',
    'GBP positioning: leveraged funds trim longs ahead of BoE.',
    'Carry unwind risk flagged as JPY vol term structure inverts.',
    'Institutional flows favor USD dips — real money bids layered.'
  ]}
];
var macroCount = 0;

function pushMacroUpdate() {
  var group = MACRO_FEED[Math.floor(Math.random() * MACRO_FEED.length)];
  var text = group.items[Math.floor(Math.random() * group.items.length)];
  macroCount++;
  document.getElementById('macro-count').textContent = 'GEO FEED // ' + String(Math.min(macroCount, 99)).padStart(2, '0');

  var board = document.getElementById('macro-board');
  var row = document.createElement('div');
  row.className = 'flex gap-3 items-start';
  var badge = document.createElement('span');
  badge.className = 'shrink-0 border ' + group.cls + ' text-[9px] px-1.5 py-0.5 rounded-sm uppercase';
  badge.textContent = group.cat;
  var p = document.createElement('p');
  p.className = 'text-slate-400';
  p.textContent = '[' + new Date().toISOString().slice(11, 16) + 'Z] ' + text;
  row.appendChild(badge); row.appendChild(p);
  board.insertBefore(row, board.firstChild);
  while (board.children.length > 12) board.removeChild(board.lastChild);
}

setInterval(function () { if (!document.hidden) pushMacroUpdate(); }, 9000);
