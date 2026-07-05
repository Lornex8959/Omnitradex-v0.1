'use strict';
/* OmniTradeX Engine // module: consensus — load order matters, see index.html */

/* ================================================================
   PHASE 9 // MODULE 3: MULTI-MODEL CONSENSUS VOTING
   Every provider with a sealed key votes LONG / SHORT / STAND on
   the active asset. Majority verdict, confidence-weighted.
   ================================================================ */
var CONSENSUS_ENGINES = [
  { name: 'gemini', modelId: 'gemini-flash' },
  { name: 'openai', modelId: 'openai-gpt' },
  { name: 'anthropic', modelId: 'anthropic-claude' },
  { name: 'groq', modelId: 'groq-llama' }
];

function consensusPayload() {
  var s = state.active;
  var d = state.last[s];
  var buf = state.buffers[s] || [];
  var rec = state.synthRec;
  return {
    systemInstruction: 'You are one voting member of a multi-model trading committee analyzing simulated market data for education. Respond with EXACTLY one line in this format and nothing else: VOTE: LONG or SHORT or STAND | CONF: <integer 0-100> | WHY: <max 12 words>',
    userQuery: 'Asset: ' + (ASSETS[s] ? ASSETS[s].label : s) +
      '. Last price: ' + d.price + '. 24h delta: ' + d.delta + '%.' +
      ' Recent ticks (oldest to newest): [' + buf.slice(-20).map(function (p) { return Number(p.toFixed(6)); }).join(', ') + '].' +
      ' Suggested strategy vector: ' + (rec ? rec.name + ' (gate ' + rec.gate + ')' : 'none yet') + '. Cast your vote.'
  };
}

function parseVote(text) {
  var v = String(text).match(/VOTE:\s*(LONG|SHORT|STAND)/i);
  var c = String(text).match(/CONF:\s*(\d{1,3})/i);
  var w = String(text).match(/WHY:\s*(.+)$/im);
  if (!v) return null;
  return {
    vote: v[1].toUpperCase(),
    conf: c ? Math.min(100, parseInt(c[1], 10)) : 50,
    why: w ? w[1].trim().slice(0, 90) : 'no reason given'
  };
}

var consensusBusy = false;
function runConsensus() {
  if (consensusBusy) return;
  var d = state.last[state.active];
  if (!d || d.price == null) {
    aiPrint('> CONSENSUS: no live data on the active asset yet. Wait for the feed.', 'text-neonamber');
    return;
  }
  var engines = CONSENSUS_ENGINES.filter(function (e) { return !!getSlot(e.name); });
  if (!engines.length) {
    aiPrint('> CONSENSUS: no engine keys sealed. Open Decipher Keys and add at least two providers.', 'text-neonamber');
    return;
  }
  if (engines.length < 2) {
    aiPrint('> CONSENSUS: only 1 engine armed (' + engines[0].name.toUpperCase() + '). A committee needs 2+ — add another key for true consensus. Running solo vote anyway...', 'text-neonamber');
  }
  consensusBusy = true;
  var payload = consensusPayload();
  aiPrint('> CONSENSUS VOTE CALLED: ' + engines.length + ' engine(s) deliberating on ' + ASSETS[state.active].label + '...', 'text-neonamber');

  var pending = engines.map(function (e) {
    var m = MODELS[e.modelId];
    return providerRequestFor(m, getSlot(e.name), payload)
      .then(function (text) { return { engine: m.label, result: parseVote(text) }; })
      .catch(function (err) { return { engine: m.label, error: err.message }; });
  });

  Promise.all(pending).then(function (results) {
    var tally = { LONG: 0, SHORT: 0, STAND: 0 };
    var weights = { LONG: 0, SHORT: 0, STAND: 0 };
    var counted = 0;
    results.forEach(function (r) {
      if (r.error) {
        aiPrint('> [' + r.engine + '] uplink failed: ' + r.error, 'text-neonred');
        return;
      }
      if (!r.result) {
        aiPrint('> [' + r.engine + '] returned an unparseable ballot — vote discarded.', 'text-neonred');
        return;
      }
      counted++;
      tally[r.result.vote]++;
      weights[r.result.vote] += r.result.conf;
      var col = r.result.vote === 'LONG' ? 'text-neongreen' : r.result.vote === 'SHORT' ? 'text-neonred' : 'text-slate-400';
      aiPrint('> [' + r.engine + '] ' + r.result.vote + ' @ ' + r.result.conf + '% — ' + r.result.why, col);
    });
    if (!counted) {
      aiPrint('> CONSENSUS ABORTED: no valid ballots returned.', 'text-neonred');
    } else {
      var verdict = 'STAND';
      if (weights.LONG > weights.SHORT && weights.LONG > weights.STAND) verdict = 'LONG';
      else if (weights.SHORT > weights.LONG && weights.SHORT > weights.STAND) verdict = 'SHORT';
      var avgConf = Math.round((weights.LONG + weights.SHORT + weights.STAND) / counted);
      var vCol = verdict === 'LONG' ? 'text-neongreen' : verdict === 'SHORT' ? 'text-neonred' : 'text-neonamber';
      aiPrint('> ══ COMMITTEE VERDICT: ' + verdict + ' ══ (' + tally.LONG + 'L / ' + tally.SHORT + 'S / ' + tally.STAND + ' stand, avg conf ' + avgConf + '%)', vCol);
      if (verdict === 'STAND') aiPrint('> Committee says patience. The directive stands aside — so should you.', 'text-slate-400');
      if (window.__otxPilotXP) window.__otxPilotXP(3); // seeking second opinions earns XP
    }
    consensusBusy = false;
  });
}
document.getElementById('btn-ai-consensus').addEventListener('click', runConsensus);
