'use strict';
/* OmniTradeX Engine // module: mentor — load order matters, see index.html */

/* ================================================================
   PHASE 7 // MODULE 3: AI MENTOR — DISCIPLINE PARTNER
   Context-aware chat: live market state + your sim ledger + learned
   edge are injected into every question. Falls back to a local
   rule-based coach when no API key is deciphered.
   ================================================================ */
var MENTOR_SLOT = 'qc3_mentor';
var mentorHistory = [];
try { mentorHistory = JSON.parse(localStorage.getItem(MENTOR_SLOT)) || []; } catch (e) { mentorHistory = []; }

function saveMentor() {
  while (mentorHistory.length > 12) mentorHistory.shift();
  localStorage.setItem(MENTOR_SLOT, JSON.stringify(mentorHistory));
}

function mentorBubble(role, text) {
  var log = document.getElementById('mentor-log');
  var wrap = document.createElement('div');
  var isUser = role === 'user';
  wrap.className = isUser
    ? 'max-w-[85%] ml-auto border border-neoncyan/30 bg-neoncyan/5 rounded-sm px-3 py-2 text-slate-300'
    : 'max-w-[85%] border border-neongreen/30 bg-neongreen/5 rounded-sm px-3 py-2 text-slate-300';
  var tag = document.createElement('p');
  tag.className = 'font-orbitron text-[9px] tracking-widest uppercase mb-1 ' + (isUser ? 'text-neoncyan' : 'text-neongreen');
  tag.textContent = isUser ? 'You' : 'Mentor';
  wrap.appendChild(tag);
  var body = document.createElement('div');
  renderMarkdown(body, text);
  wrap.appendChild(body);
  log.appendChild(wrap);
  log.scrollTop = log.scrollHeight;
  return wrap;
}

function mentorContext() {
  var symbol = state.active;
  var d = state.last[symbol];
  var mtf = computeMTF(symbol);
  var myTotal = ledger.wins + ledger.losses;
  var top = null, topEq = -Infinity;
  ARENA_BOTS.forEach(function (b) {
    if (arena.stats[b.id].equity > topEq) { topEq = arena.stats[b.id].equity; top = b.name; }
  });
  return '== LIVE CONTEXT (auto-injected) ==\n' +
    'ACTIVE ASSET: ' + ASSETS[symbol].label + ' @ ' + fmtPrice(symbol, d.price) + ' (24h ' + (d.delta || 0).toFixed(2) + '%)\n' +
    'MTF GATE: ' + mtf.gate + '\n' +
    'USER SIM LEDGER: equity ' + fmtUsd(ledger.equity) + ' | ' + ledger.wins + 'W/' + ledger.losses + 'L' +
    (myTotal ? ' (' + ((ledger.wins / myTotal) * 100).toFixed(0) + '% WR)' : ' (no trades yet)') +
    ' | open positions: ' + ledger.open.length + ' | circuit breaker: ' + (breakerTripped() ? 'TRIPPED (daily -3%)' : 'armed') + '\n' +
    'ADAPTIVE ENGINE: ' + learningContext().split('\n')[0] + '\n' +
    'ARENA LEADER: ' + (top || 'n/a') + ' @ ' + fmtUsd(topEq) + '\n' +
    'RECENT INTEL: ' + (typeof newsItems !== 'undefined' && newsItems.length ? newsItems.slice(0, 3).map(function (n) { return n.headline; }).join(' | ') : 'none loaded');
}

/* Local rule-based coach when no API key is present */
function mentorHeuristic(q) {
  var s = q.toLowerCase();
  if (/revenge|angry|loss|lost|tilt|again immediately/.test(s)) {
    return '**Stop. Breathe.** Revenge trading is how small losses become blown accounts.\n' +
      '- Your circuit breaker exists for this exact moment: ' + (breakerTripped() ? 'it is TRIPPED — you are done for today, and that is a win.' : 'you still have room, but only take A+ setups.') + '\n' +
      '- Rule: after a loss, wait for the NEXT clean MTF-gated signal. No gate, no trade.\n' +
      '- Journal the loss first: what was the setup, did you follow the plan? If yes, it was a good trade with a bad outcome.';
  }
  if (/size|sizing|how much|position|lot/.test(s)) {
    var risk = ledger.equity * 0.01;
    return '**Position sizing, by the book:**\n' +
      '- Risk exactly **1% of equity** per trade: that is ' + fmtUsd(risk) + ' on your current ' + fmtUsd(ledger.equity) + ' sim account.\n' +
      '- Qty = risk amount / distance to stop. Wider stop = smaller size, automatically.\n' +
      '- Never add to losers. Scale winners only after the stop is at break-even.';
  }
  if (/market|now|today|look|update|bias/.test(s)) {
    var symbol = state.active;
    var mtf = computeMTF(symbol);
    var d = state.last[symbol];
    return '**' + ASSETS[symbol].label + ' right now:** ' + fmtPrice(symbol, d.price) + ' (' + (d.delta || 0).toFixed(2) + '% 24h)\n' +
      '- MTF gate reads **' + mtf.gate + '** — ' + (mtf.gate === 'BLOCKED' || mtf.gate === 'WAIT' ? 'timeframes disagree, so the disciplined play is patience.' : 'timeframes align; if you trade, honor the directive card SL/TP exactly.') + '\n' +
      '- Check the Global Intel radar before entering: news beats technicals.';
  }
  if (/review|performance|improve|stats/.test(s)) {
    var t = ledger.wins + ledger.losses;
    return '**Your sim desk review:**\n' +
      '- Record: ' + ledger.wins + 'W / ' + ledger.losses + 'L' + (t ? ' (' + ((ledger.wins / t) * 100).toFixed(0) + '% win rate)' : '') + ', equity ' + fmtUsd(ledger.equity) + '.\n' +
      '- ' + (t < 10 ? 'Sample is still small — focus on process, not P/L. Take 10+ gated trades before judging anything.' :
        (ledger.wins / t >= 0.5 ? 'Positive edge forming. Protect it: same risk every trade, no impulse entries.' :
        'Win rate is below 50%. Cut trade frequency in half and ONLY take directives with confidence above 65%.')) + '\n' +
      '- Compare yourself to the Arena bots — if a rule-based bot beats you, your discipline (not your analysis) is the leak.';
  }
  return '**Here to help.** Ask me about: current market bias, position sizing, handling losses, or reviewing your sim performance.\n' +
    '- For deeper AI-powered coaching, decipher an API key in the Key Vault and I upgrade to full cognitive mode.';
}

var mentorBusy = false;
function mentorAsk(q) {
  if (mentorBusy || !q.trim()) return;
  mentorBubble('user', q);
  mentorHistory.push({ role: 'user', text: q });
  saveMentor();
  if (window.__otxPilotXP) window.__otxPilotXP(2); // learning earns XP
  var status = document.getElementById('mentor-status');

  if (!modelKey()) {
    var a = mentorHeuristic(q);
    mentorBubble('mentor', a);
    mentorHistory.push({ role: 'mentor', text: a });
    saveMentor();
    status.textContent = 'LOCAL COACH // NO KEY';
    return;
  }

  mentorBusy = true;
  status.textContent = activeModel().label + ' // THINKING';
  status.className = 'font-techmono text-[10px] text-neongreen';
  var thinking = mentorBubble('mentor', '_Reading the desk..._');

  var convo = mentorHistory.slice(-8).map(function (m) {
    return (m.role === 'user' ? 'TRADER: ' : 'MENTOR: ') + m.text;
  }).join('\n');

  callModel({
    systemInstruction:
      'You are MENTOR, a friendly, veteran trading desk partner inside the OMNITRADEX ENGINE terminal. ' +
      'Your #1 mission: protect the trader\u2019s capital and discipline. Give short, warm, practical answers ' +
      '(max 130 words, markdown, bullets welcome). Always anchor advice in risk management: 1% risk rule, ' +
      'stop-loss discipline, no revenge trading, respect the MTF gate and circuit breaker. ' +
      'Use the injected live context. Never give guaranteed predictions; frame everything as scenarios with risk.',
    userQuery: mentorContext() + '\n\n== CONVERSATION ==\n' + convo + '\nTRADER: ' + q
  }).then(function (text) {
    thinking.remove();
    mentorBubble('mentor', text);
    mentorHistory.push({ role: 'mentor', text: text });
    saveMentor();
  }).catch(function (err) {
    thinking.remove();
    var fb = mentorHeuristic(q) + '\n- (Uplink failed: ' + err.message + ' — answered locally.)';
    mentorBubble('mentor', fb);
    mentorHistory.push({ role: 'mentor', text: fb });
    saveMentor();
  }).finally(function () {
    mentorBusy = false;
    status.textContent = activeModel().label + ' // READY';
    status.className = 'font-techmono text-[10px] text-slate-500';
  });
}

document.getElementById('mentor-form').addEventListener('submit', function (e) {
  e.preventDefault();
  var input = document.getElementById('mentor-input');
  mentorAsk(input.value);
  input.value = '';
});
Array.prototype.forEach.call(document.querySelectorAll('.mentor-chip'), function (chip) {
  chip.addEventListener('click', function () { mentorAsk(chip.getAttribute('data-q')); });
});
// restore prior mentor conversation
mentorHistory.slice(-6).forEach(function (m) { mentorBubble(m.role === 'user' ? 'user' : 'mentor', m.text); });
