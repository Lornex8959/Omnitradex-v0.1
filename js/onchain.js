'use strict';
/* OmniTradeX Engine // module: onchain — load order matters, see index.html */

/* ================================================================
   PHASE 5 // MODULE 3: PREDATORY BOT & WHALE BEHAVIOR TRACKING
   Simulated behavior state machine per node. A TRAP-DETECTED state
   on the monitored node raises the execution-pause flag fed to AI.
   ================================================================ */
var NODE_STATES = ['DORMANT', 'ACCUMULATING', 'DISTRIBUTING', 'TRAP-DETECTED'];
var NODE_STATE_CLS = {
  'DORMANT': 'text-slate-600',
  'ACCUMULATING': 'text-neongreen',
  'DISTRIBUTING': 'text-neonamber',
  'TRAP-DETECTED': 'text-neonred font-semibold'
};
var nodeStates = {}; // idx -> state
state.execPaused = false;

function rollNodeStates() {
  var changedMonitored = false;
  walletNodes.forEach(function (node, idx) {
    var prev = nodeStates[idx] || 'DORMANT';
    // weighted transition: mostly benign, occasional trap
    var r = Math.random();
    var next = r < 0.45 ? 'DORMANT' : r < 0.70 ? 'ACCUMULATING' : r < 0.92 ? 'DISTRIBUTING' : 'TRAP-DETECTED';
    nodeStates[idx] = next;
    if (idx === state.walletIdx && next !== prev) {
      changedMonitored = true;
      if (next === 'TRAP-DETECTED') {
        aiPrint('> MANIPULATION TRAP flagged on ' + node.tag + ' — EXECUTION PAUSED.', 'text-neonred');
        logAnomaly(state.active, 'TRAP', node.tag + ' predatory pattern detected — signals suspended');
      } else if (prev === 'TRAP-DETECTED') {
        aiPrint('> Trap cleared on ' + node.tag + '. Execution window reopened.', 'text-neongreen');
      }
    }
  });
  state.execPaused = nodeStates[state.walletIdx] === 'TRAP-DETECTED';
  if (changedMonitored || true) renderWalletList();
}

function monitoredNodeState() { return nodeStates[state.walletIdx] || 'DORMANT'; }

function renderWalletList() {
  el.walletList.innerHTML = '';
  walletNodes.forEach(function (node, idx) {
    var m = nodeMetrics(node);
    var active = idx === state.walletIdx;
    var row = document.createElement('div');
    row.className = 'border rounded-sm px-3 py-2 flex items-center justify-between bg-paneldeep cursor-pointer transition-colors ' +
      (active ? 'border-neongreen/60' : 'border-gridline hover:border-neongreen/40');
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-pressed', String(active));

    var left = document.createElement('div');
    left.className = 'flex items-center gap-2 min-w-0';
    var icon = document.createElement('i');
    icon.className = 'fa-solid ' + nodeIcon(node.kind) + ' shrink-0';
    icon.setAttribute('aria-hidden', 'true');
    var info = document.createElement('div');
    info.className = 'min-w-0';
    var title = document.createElement('p');
    title.className = 'text-slate-300 truncate';
    title.textContent = node.tag + ' // ' + node.addr;
    var sub = document.createElement('p');
    sub.className = 'text-[10px] text-slate-600';
    sub.innerHTML = '';
    var subSpan = document.createElement('span');
    subSpan.className = m.color;
    subSpan.textContent = m.line;
    sub.appendChild(subSpan);
    info.appendChild(title); info.appendChild(sub);
    left.appendChild(icon); left.appendChild(info);

    var behavior = nodeStates[idx] || 'DORMANT';
    var status = document.createElement('span');
    status.className = 'text-[10px] uppercase shrink-0 text-right';
    var stateLine = document.createElement('span');
    stateLine.className = 'block ' + NODE_STATE_CLS[behavior];
    stateLine.textContent = behavior;
    var roleLine = document.createElement('span');
    roleLine.className = 'block ' + (active ? 'text-neongreen' : 'text-slate-600');
    roleLine.textContent = active ? 'Monitored' : 'Tracked';
    status.appendChild(stateLine);
    status.appendChild(roleLine);

    row.appendChild(left); row.appendChild(status);
    function select() {
      state.walletIdx = idx;
      state.execPaused = (nodeStates[idx] || 'DORMANT') === 'TRAP-DETECTED';
      renderWalletList();
      aiPrint('> Monitor lock: ' + node.tag + ' // ' + node.addr, 'text-neongreen');
    }
    row.addEventListener('click', select);
    row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
    el.walletList.appendChild(row);
  });
}

function classifyNode(addr, tag) {
  var t = (tag + addr).toUpperCase();
  if (/MEV|BOT/.test(t)) return 'mev';
  if (/FX|EUR|GBP|JPY|USD-|BLOCK/.test(t)) return 'fx';
  return 'whale';
}

el.walletForm.addEventListener('submit', function (e) {
  e.preventDefault();
  var addr = el.walletInput.value.trim();
  if (!addr) { el.walletInput.focus(); return; }
  var tag = el.walletTag.value.trim().toUpperCase() || ('NODE-' + String(walletNodes.length + 1).padStart(2, '0'));
  // shorten long chain addresses for display: 0x1234...abcd
  var display = addr.length > 16 ? addr.slice(0, 6) + '...' + addr.slice(-4) : addr;
  walletNodes.push({ addr: display, tag: tag, kind: classifyNode(addr, tag) });
  saveNodes();
  state.walletIdx = walletNodes.length - 1;
  renderWalletList();
  aiPrint('> Node injected into tracking matrix: ' + tag + ' // ' + display, 'text-neongreen');
  el.walletInput.value = '';
  el.walletTag.value = '';
});

function activeWallet() {
  var node = walletNodes[state.walletIdx] || walletNodes[0];
  var m = nodeMetrics(node);
  return node.tag + ' (' + node.addr + ') :: ' + m.metric;
}

/* ---------------- PHASE 4: INFRASTRUCTURE BINDING ---------------- */
/* Scrapes ALL active dashboard variables into a compiled inference payload */
function buildPayload() {
  var symbol = state.active;
  var d = state.last[symbol];
  var buf = state.buffers[symbol];

  // MEMORY BUFFER RETRIEVAL: re-read quantum_memory from localStorage (source of truth)
  try { quantum_memory = JSON.parse(localStorage.getItem(MEM_SLOT)) || []; }
  catch (e) { /* keep in-memory copy */ }

  var mtf = computeMTF(symbol);
  var ts = trailStop(symbol);
  var rec = state.synthRec;

  return {
    systemInstruction:
      'You are QUANTUM CORE v3, an elite trading intelligence engine. ' +
      'Respond in markdown with a concise tactical market analysis (max 120 words): a **BIAS** line (LONG/SHORT/NEUTRAL), ' +
      '2-3 bullet points of reasoning, and a risk note honoring the provided SL/TP boundaries. ' +
      'HARD RULE: if the MTF GATE is BLOCKED or EXECUTION PAUSE is TRUE, your bias MUST be NEUTRAL/stand-aside. ' +
      'Finish on the final line with "MEMORY:" followed by a single-sentence summary of your analysis for your future self.',
    userQuery:
      '== LIVE DASHBOARD SCRAPE ==\n' +
      'ASSET: ' + ASSETS[symbol].label + ' (' + ASSETS[symbol].type.toUpperCase() + ')\n' +
      'LIVE SPOT PRICE: ' + fmtPrice(symbol, d.price) + '\n' +
      '24H DELTA: ' + (d.delta || 0).toFixed(2) + '%\n' +
      'DYNAMIC TRAIL SL (' + (ts ? (ts.pct * 100).toFixed(1) : '2.0') + '% vol-adjusted, peak-ratcheted): ' + fmtPrice(symbol, ts ? ts.sl : (d.price || 0) * 0.98) + '\n' +
      'TARGET (4%): ' + fmtPrice(symbol, (d.price || 0) * 1.04) + '\n' +
      'RECENT TICK ARRAY (' + buf.length + 'pt window, last 10): ' + buf.slice(-10).map(function (v) { return v.toFixed(ASSETS[symbol].decimals); }).join(', ') + '\n\n' +
      '== MULTI-TIMEFRAME FILTER ==\n' +
      'FAST(' + MTF_WINDOWS.fast + 't): ' + mtf.fast.dir + ' (z=' + mtf.fast.z.toFixed(2) + ') | MID(' + MTF_WINDOWS.mid + 't): ' + mtf.mid.dir + ' (z=' + mtf.mid.z.toFixed(2) + ') | SLOW(' + MTF_WINDOWS.slow + 't): ' + mtf.slow.dir + ' (z=' + mtf.slow.z.toFixed(2) + ')\n' +
      'ALIGNMENT GATE: ' + mtf.gate + '\n\n' +
      '== ACTIVE STRATEGY MATRIX ==\n' +
      'DEPLOYED VECTOR: ' + activeStrategy() + '\n' +
      'RULES: ' + (STRATEGY_RULES[activeStrategy()] || 'Standard discretionary execution.') + '\n' +
      'SYNTHESIS ENGINE BEST-FIT: ' + (rec ? rec.name + ' (score ' + rec.score + ')' : 'pending data') + '\n\n' +
      '== MONITORED NODE (ON-CHAIN / FX BLOCK) ==\n' +
      'ACTIVE MONITOR: ' + activeWallet() + '\n' +
      'BEHAVIOR STATE: ' + monitoredNodeState() + '\n' +
      'EXECUTION PAUSE: ' + (state.execPaused ? 'TRUE — manipulation trap active, stand aside' : 'FALSE') + '\n' +
      'TRACKED NODES: ' + walletNodes.length + '\n\n' +
      '== ADAPTIVE LEARNING ENGINE (self-trained on live outcomes) ==\n' +
      learningContext() + '\n\n' +
      '== PAST COGNITIVE MEMORIES (last ' + Math.min(quantum_memory.length, 5) + ' decisions — maintain continuity) ==\n' +
      memoryContext()
  };
}
