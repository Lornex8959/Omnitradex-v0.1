'use strict';
/* OmniTradeX Engine // module: alerts — load order matters, see index.html */

/* ================================================================
   PHASE 9 // MODULE 1: SOUND & NOTIFICATION ALERTS
   WebAudio tones (no external assets) + optional browser
   notifications when the tab is hidden. Toggle persists locally.
   ================================================================ */
var ALERTS_SLOT = 'otx_alerts';
var alertsOn = localStorage.getItem(ALERTS_SLOT) === '1';
var audioCtx = null;

function beep(freq, startOffset, dur) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var t0 = audioCtx.currentTime + startOffset;
    var osc = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch (e) { /* audio unavailable in this context: stay silent */ }
}

function alertTone(kind) {
  if (kind === 'fill') { beep(660, 0, 0.09); beep(880, 0.11, 0.09); }
  else if (kind === 'win') { beep(523, 0, 0.1); beep(659, 0.12, 0.1); beep(784, 0.24, 0.16); }
  else if (kind === 'loss') { beep(392, 0, 0.12); beep(262, 0.15, 0.2); }
  else if (kind === 'breaker') { beep(220, 0, 0.18); beep(220, 0.25, 0.18); beep(220, 0.5, 0.3); }
  else beep(990, 0, 0.07);
}

function otxAlert(kind, title, body) {
  if (!alertsOn) return;
  alertTone(kind);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification('OmniTradeX — ' + title, { body: body }); } catch (e) { /* blocked */ }
  }
}

function renderAlertsBtn() {
  var icon = document.getElementById('alerts-icon');
  var btn = document.getElementById('btn-alerts');
  if (!icon || !btn) return;
  icon.className = alertsOn ? 'fa-solid fa-bell' : 'fa-solid fa-bell-slash';
  btn.className = 'btn-neon font-orbitron text-xs tracking-widest rounded-sm px-3 py-2 uppercase ' + (alertsOn ? 'text-neongreen' : 'text-slate-500');
  btn.style.borderColor = alertsOn ? 'rgba(74,222,128,0.5)' : '';
  btn.style.background = alertsOn ? 'rgba(74,222,128,0.06)' : '';
}

document.getElementById('btn-alerts').addEventListener('click', function () {
  alertsOn = !alertsOn;
  localStorage.setItem(ALERTS_SLOT, alertsOn ? '1' : '0');
  renderAlertsBtn();
  if (alertsOn) {
    alertTone('fill'); // audible confirmation (also unlocks the AudioContext via this gesture)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    aiPrint('> ALERTS ARMED: sim fills, wins, losses and circuit breakers now ping audio + notifications.', 'text-neongreen');
  } else {
    aiPrint('> ALERTS MUTED: desk returns to silent running.', 'text-slate-500');
  }
});
renderAlertsBtn();
