'use strict';
/* OmniTradeX Engine // module: vault — load order matters, see index.html */

/* ================================================================
   SECURE PROVIDER BOUNDARY
   Provider credentials are intentionally not accepted or persisted by
   this legacy browser terminal. Use a server-side authenticated route.
   ================================================================ */
var KEY_SLOT = 'qc3_gemini_key';
var VAULT_SLOTS = {
  gemini: 'qc3_gemini_key',
  openai: 'qc3_openai_key',
  anthropic: 'qc3_anthropic_key',
  groq: 'qc3_groq_key',
  finnhub: 'qc3_finnhub_key'
};
var MODEL_SLOT = 'qc3_model';

// Remove credentials created by older insecure versions on first load.
Object.keys(VAULT_SLOTS).forEach(function (name) { localStorage.removeItem(VAULT_SLOTS[name]); });

function getSlot() { return ''; }
function getKey() { return ''; }
function activeModelId() { return localStorage.getItem(MODEL_SLOT) || 'gemini-flash'; }

/* Premium model registry: provider adapters resolve endpoint + auth shape */
var MODELS = {
  'gemini-flash':     { label: 'GEMINI 2.5 FLASH', provider: 'gemini', model: 'gemini-2.5-flash' },
  'gemini-pro':       { label: 'GEMINI 2.5 PRO',   provider: 'gemini', model: 'gemini-2.5-pro' },
  'openai-gpt':       { label: 'GPT-4O',           provider: 'openai', model: 'gpt-4o' },
  'anthropic-claude': { label: 'CLAUDE SONNET',    provider: 'anthropic', model: 'claude-sonnet-4-5' },
  'groq-llama':       { label: 'GROQ LLAMA-3.3',   provider: 'groq', model: 'llama-3.3-70b-versatile' }
};
function activeModel() { return MODELS[activeModelId()] || MODELS['gemini-flash']; }
function modelKey() {
  var p = activeModel().provider;
  return getSlot(p === 'gemini' ? 'gemini' : p);
}
function anyModelKey() { return !!(getSlot('gemini') || getSlot('openai') || getSlot('anthropic') || getSlot('groq')); }

// Inline modal replaces window.prompt (which is blocked in sandboxed iframes)
var keyModal = document.getElementById('key-modal');
var keyForm = document.getElementById('key-form');
var keyInput = document.getElementById('key-input');
var vaultInputs = {
  gemini: keyInput,
  openai: document.getElementById('key-openai'),
  anthropic: document.getElementById('key-anthropic'),
  groq: document.getElementById('key-groq'),
  finnhub: document.getElementById('key-finnhub')
};
var modelSelect = document.getElementById('model-select');

function closeKeyModal() {
  keyModal.classList.add('hidden');
  keyModal.classList.remove('flex');
  Object.keys(vaultInputs).forEach(function (n) { vaultInputs[n].value = ''; });
  el.keysBtn.focus();
}

el.keysBtn.addEventListener('click', function () {
  keyModal.classList.remove('hidden');
  keyModal.classList.add('flex');
  Object.keys(vaultInputs).forEach(function (n) { vaultInputs[n].value = getSlot(n); });
  modelSelect.value = activeModelId();
  keyInput.focus();
});

keyForm.addEventListener('submit', function (e) {
  e.preventDefault();
  // This legacy browser surface never persists or transmits provider secrets.
  Object.keys(VAULT_SLOTS).forEach(function (n) { localStorage.removeItem(VAULT_SLOTS[n]); });
  localStorage.setItem(MODEL_SLOT, modelSelect.value);
  aiPrint('> Provider keys are disabled in the browser terminal.', 'text-neonamber');
  aiPrint('> Configure a server-side authenticated AI route before enabling inference.', 'text-slate-400');
  setFooterKeys(false);
  setLoader(false);
  closeKeyModal();
});

document.getElementById('key-purge').addEventListener('click', function () {
  Object.keys(VAULT_SLOTS).forEach(function (n) { localStorage.removeItem(VAULT_SLOTS[n]); });
  localStorage.removeItem(MODEL_SLOT);
  aiPrint('> Key vault purged: all credentials wiped from local sandbox.', 'text-neonamber');
  setFooterKeys(false);
  setLoader(false);
  closeKeyModal();
});

document.getElementById('key-cancel').addEventListener('click', closeKeyModal);
keyModal.addEventListener('click', function (e) { if (e.target === keyModal) closeKeyModal(); });
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !keyModal.classList.contains('hidden')) closeKeyModal();
});

/* ---------------- QUANTUM MEMORY BUFFER (self-learning) ---------------- */
var MEM_SLOT = 'quantum_memory';
var quantum_memory = [];
try { quantum_memory = JSON.parse(localStorage.getItem(MEM_SLOT)) || []; }
catch (e) { quantum_memory = []; }

function pushMemory(summary) {
  quantum_memory.push({ t: new Date().toISOString(), s: String(summary).slice(0, 220) });
  while (quantum_memory.length > 5) quantum_memory.shift();
  localStorage.setItem(MEM_SLOT, JSON.stringify(quantum_memory));
}

function memoryContext() {
  if (!quantum_memory.length) return 'No prior cognitive memories recorded.';
  return quantum_memory.map(function (m, i) {
    return (i + 1) + '. [' + m.t.slice(11, 19) + ' UTC] ' + m.s;
  }).join('\n');
}

/* ---------------- AI TERMINAL ---------------- */
function aiPrint(text, cls) {
  var p = document.createElement('p');
  p.className = cls || 'text-slate-400';
  p.textContent = text;
  el.aiLog.appendChild(p);
  el.aiLog.scrollTop = el.aiLog.scrollHeight;
  while (el.aiLog.children.length > 60) el.aiLog.removeChild(el.aiLog.firstChild);
}

/* ---------------- STRATEGY DECK: DEPLOYED STATE ---------------- */
var STRATEGY_RULES = {
  'ICT Liquidity Recon': 'Hunt fair value gaps and liquidity sweeps above/below equal highs-lows; enter on displacement after the sweep.',
  'Wyckoff Accumulation': 'Identify accumulation phases (PS, SC, AR, ST); enter on spring test with rising volume confirmation.',
  'HFT Order Book Delta': 'Track bid-ask volume imbalances; follow aggressive delta divergence at key levels.',
  'MEV Flash Loan Front-Run': 'Monitor on-chain pool exploitation windows; mirror profitable MEV bundle patterns.',
  'Funding Rate Carry Recon': 'Arbitrage perp-spot basis; long spot / short perp when funding is heavily positive.',
  'Statistical Mean Reversion': 'Fade moves beyond 3x standard deviation from the 50-tick mean; target reversion to band center.',
  'Sentiment Correlation': 'Match macro news fear-greed extremes against price divergence; fade euphoria, buy panic.',
  'Gamma Squeeze Force': 'Locate dealer hedging inflection strikes; ride forced hedging flows into gamma walls.',
  'Multi-Tier Grid Flow': 'Deploy layered grid orders across sideways range; harvest oscillation with tight spacing.',
  'Whale Wallet Mimicry': 'Track high-ROI wallet accumulation logs; shadow entries within a controlled slippage window.'
};

state.strategy = 'ICT Liquidity Recon'; // active dashboard variable

function activeStrategy() { return state.strategy; }

// strategy deck selection: clicking deploys the vector into system state
Array.prototype.forEach.call(el.deck.querySelectorAll('.strategy-card'), function (card) {
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  function deploy() {
    el.deck.querySelectorAll('.strategy-card').forEach(function (c) {
      c.classList.remove('active-strat');
      var badge = c.querySelector('.deploy-badge');
      if (badge) badge.remove();
      var chk = c.querySelector('.fa-circle-check');
      if (chk) chk.remove();
    });
    card.classList.add('active-strat');
    var badge = document.createElement('span');
    badge.className = 'deploy-badge shrink-0 border border-neoncyan/60 text-neoncyan text-[9px] px-1.5 py-0.5 rounded-sm uppercase font-orbitron';
    badge.textContent = 'Deployed';
    card.appendChild(badge);
    state.strategy = card.querySelector('p').textContent;
    aiPrint('> Strategy vector DEPLOYED: ' + state.strategy.toUpperCase(), 'text-neoncyan');
  }
  card.addEventListener('click', deploy);
  card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); deploy(); } });
});
// mark the initially active card as Deployed
(function () {
  var init = el.deck.querySelector('.active-strat');
  if (init) {
    var chk = init.querySelector('.fa-circle-check');
    if (chk) chk.remove();
    var badge = document.createElement('span');
    badge.className = 'deploy-badge shrink-0 border border-neoncyan/60 text-neoncyan text-[9px] px-1.5 py-0.5 rounded-sm uppercase font-orbitron';
    badge.textContent = 'Deployed';
    init.appendChild(badge);
  }
})();

/* ---------------- ON-CHAIN & FOREX BLOCK MONITOR ---------------- */
var WALLET_SLOT = 'qc3_wallet_nodes';
var DEFAULT_NODES = [
  { addr: '0x7f3d...a9c2', tag: 'WHALE-α', kind: 'whale' },
  { addr: '0x1b8e...44de', tag: 'MEV-BOT-07', kind: 'mev' },
  { addr: 'EURUSD-INST', tag: 'FX-ORDERBLOCK', kind: 'fx' }
];

function loadNodes() {
  try {
    var saved = JSON.parse(localStorage.getItem(WALLET_SLOT));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch (e) { /* corrupt store: fall through */ }
  return DEFAULT_NODES.slice();
}
var walletNodes = loadNodes();
state.walletIdx = 0; // active monitored node (dashboard variable)

// Deterministic simulated metrics per node (stable across renders)
function nodeMetrics(node) {
  var seed = 0;
  var s = node.addr + node.tag;
  for (var i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) >>> 0;
  var r1 = (seed % 900) / 10 + 12;        // 12.0 - 101.9
  var r2 = seed % 400 + 40;               // 40 - 439
  var r3 = ((seed >> 4) % 250) / 10 + 5;  // 5.0 - 29.9
  if (node.kind === 'mev') return { line: 'SANDWICH OPS: ' + r2, metric: r2 + ' ops/24h', color: 'text-neonamber' };
  if (node.kind === 'fx') return { line: 'BLOCK DEPTH: ' + r3.toFixed(1) + 'M', metric: r3.toFixed(1) + 'M depth', color: 'text-neoncyan' };
  return { line: 'ROI 30D: +' + r1.toFixed(1) + '%', metric: '+' + r1.toFixed(1) + '% ROI/30d', color: 'text-neongreen' };
}

function nodeIcon(kind) {
  if (kind === 'mev') return 'fa-robot text-neonmagenta';
  if (kind === 'fx') return 'fa-building-columns text-neonamber';
  return 'fa-fish text-neoncyan';
}

function saveNodes() { localStorage.setItem(WALLET_SLOT, JSON.stringify(walletNodes)); }
