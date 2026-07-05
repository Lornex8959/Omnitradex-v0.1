'use strict';
/* OmniTradeX Engine // module: profiles — load order matters, see index.html */

/* ================================================================
   PHASE 8 // MODULE 1: DUAL THEME ENGINE (NIGHT OPS / SOLAR DECK)
   ================================================================ */
var THEME_SLOT = 'otx_theme';
function applyTheme(t) {
  document.documentElement.classList.toggle('light', t === 'light');
  var ic = document.getElementById('theme-icon');
  if (ic) ic.className = 'fa-solid ' + (t === 'light' ? 'fa-sun' : 'fa-moon');
  localStorage.setItem(THEME_SLOT, t);
  drawWaveform(); // repaint chart under new theme
}
document.getElementById('btn-theme').addEventListener('click', function () {
  applyTheme(document.documentElement.classList.contains('light') ? 'dark' : 'light');
});
applyTheme(localStorage.getItem(THEME_SLOT) || 'dark');

/* ================================================================
   PHASE 8 // MODULE 2: PILOT PROFILES — SOVEREIGN LOCAL ACCOUNTS
   Salted SHA-256 passphrase hashing via WebCrypto. Progress slots
   (ledger, learning, arena, mentor, memory, nodes) snapshot per
   pilot so each account resumes exactly where it left off.
   Nothing ever leaves this browser.
   ================================================================ */
var PILOTS_SLOT = 'otx_pilots';
var SESSION_SLOT = 'otx_session';
var PROGRESS_SLOTS = ['qc3_ledger', 'qc3_learning', 'qc3_arena', 'qc3_mentor', 'quantum_memory', 'qc3_wallet_nodes', 'otx_journal'];
var RANKS = ['CADET', 'OPERATOR', 'SPECIALIST', 'VETERAN', 'COMMANDER', 'QUANTUM ELITE'];

function loadPilots() {
  try { return JSON.parse(localStorage.getItem(PILOTS_SLOT)) || {}; } catch (e) { return {}; }
}
function savePilots(p) { localStorage.setItem(PILOTS_SLOT, JSON.stringify(p)); }
function activePilot() { return localStorage.getItem(SESSION_SLOT) || ''; }

function sha256Hex(text) {
  if (window.crypto && crypto.subtle) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }
  // non-secure-context fallback (weaker, still never transmitted)
  var h = 5381;
  for (var i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return Promise.resolve('djb2_' + (h >>> 0).toString(16));
}

function snapshotProgress(name) {
  var blob = {};
  PROGRESS_SLOTS.forEach(function (k) { blob[k] = localStorage.getItem(k); });
  localStorage.setItem('otx_profile_' + name, JSON.stringify(blob));
}
function restoreProgress(name) {
  var raw = localStorage.getItem('otx_profile_' + name);
  if (!raw) return;
  try {
    var blob = JSON.parse(raw);
    PROGRESS_SLOTS.forEach(function (k) {
      if (blob[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, blob[k]);
    });
  } catch (e) { /* corrupt profile blob: keep current state */ }
}

function pilotLevel(xp) { return Math.floor(Math.sqrt((xp || 0) / 25)) + 1; }
function pilotRank(xp) { return RANKS[Math.min(pilotLevel(xp) - 1, RANKS.length - 1)]; }

function pilotXP(amount) {
  var name = activePilot();
  if (!name) return;
  var pilots = loadPilots();
  if (!pilots[name]) return;
  pilots[name].xp = (pilots[name].xp || 0) + amount;
  savePilots(pilots);
  renderPilotHud();
}
window.__otxPilotXP = pilotXP;

function renderPilotHud() {
  var name = activePilot();
  var pilots = loadPilots();
  var label = document.getElementById('pilot-label');
  var ftr = document.getElementById('ftr-pilot');
  if (name && pilots[name]) {
    var xp = pilots[name].xp || 0;
    label.textContent = name.toUpperCase() + ' // LV' + pilotLevel(xp);
    ftr.textContent = name.toUpperCase() + ' // ' + pilotRank(xp) + ' // ' + xp + ' XP';
    ftr.className = 'text-neongreen';
  } else {
    label.textContent = 'Pilot Login';
    ftr.textContent = 'GUEST // PROGRESS NOT PROFILE-BOUND';
    ftr.className = 'text-slate-500';
  }
}

var pilotModal = document.getElementById('pilot-modal');
function openPilotModal() {
  var name = activePilot();
  var pilots = loadPilots();
  var box = document.getElementById('pilot-session-box');
  var logout = document.getElementById('pilot-logout-btn');
  document.getElementById('pilot-status').textContent = '';
  if (name && pilots[name]) {
    var xp = pilots[name].xp || 0;
    box.classList.remove('hidden');
    logout.classList.remove('hidden');
    document.getElementById('pilot-session-line').textContent = 'ACTIVE: ' + name.toUpperCase() + ' // LEVEL ' + pilotLevel(xp) + ' ' + pilotRank(xp);
    document.getElementById('pilot-rank-line').textContent = xp + ' XP // progress auto-saved to this profile every 60s';
  } else {
    box.classList.add('hidden');
    logout.classList.add('hidden');
  }
  pilotModal.classList.remove('hidden');
  pilotModal.classList.add('flex');
  document.getElementById('pilot-name').focus();
}
function closePilotModal() {
  pilotModal.classList.add('hidden');
  pilotModal.classList.remove('flex');
}
document.getElementById('btn-pilot').addEventListener('click', openPilotModal);
document.getElementById('pilot-cancel-btn').addEventListener('click', closePilotModal);
pilotModal.addEventListener('click', function (e) { if (e.target === pilotModal) closePilotModal(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pilotModal.classList.contains('hidden')) closePilotModal(); });

function pilotStatus(msg, ok) {
  var s = document.getElementById('pilot-status');
  s.textContent = msg;
  s.className = 'font-techmono text-[10px] min-h-[14px] ' + (ok ? 'text-neongreen' : 'text-neonamber');
}

function pilotSignup() {
  var name = document.getElementById('pilot-name').value.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  var pass = document.getElementById('pilot-pass').value;
  if (name.length < 3) return pilotStatus('Callsign must be 3+ chars (letters, numbers, - or _).');
  if (pass.length < 6) return pilotStatus('Passphrase must be 6+ characters.');
  var pilots = loadPilots();
  if (pilots[name]) return pilotStatus('Callsign already registered on this device. Log in instead.');
  var salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sha256Hex(salt + '::' + pass).then(function (hash) {
    pilots[name] = { salt: salt, hash: hash, created: Date.now(), xp: 0 };
    savePilots(pilots);
    var prev = activePilot();
    if (prev) snapshotProgress(prev);
    localStorage.setItem(SESSION_SLOT, name);
    snapshotProgress(name); // adopt current desk as this pilot's starting state
    renderPilotHud();
    pilotStatus('Pilot ' + name.toUpperCase() + ' registered. Welcome aboard, Cadet.', true);
    aiPrint('> PILOT REGISTERED: ' + name.toUpperCase() + ' — desk progress is now profile-bound.', 'text-neongreen');
    setTimeout(closePilotModal, 900);
  });
}

function pilotLogin() {
  var name = document.getElementById('pilot-name').value.trim();
  var pass = document.getElementById('pilot-pass').value;
  var pilots = loadPilots();
  if (!pilots[name]) return pilotStatus('Unknown callsign on this device. Register first.');
  sha256Hex(pilots[name].salt + '::' + pass).then(function (hash) {
    if (hash !== pilots[name].hash) return pilotStatus('Passphrase rejected. Access denied.');
    var prev = activePilot();
    if (prev && prev !== name) snapshotProgress(prev);
    localStorage.setItem(SESSION_SLOT, name);
    restoreProgress(name);
    pilotStatus('Access granted. Restoring your desk...', true);
    setTimeout(function () { location.reload(); }, 700); // re-ignite all engines with restored slots
  });
}

document.getElementById('pilot-form').addEventListener('submit', function (e) {
  e.preventDefault();
  pilotLogin();
});
document.getElementById('pilot-signup-btn').addEventListener('click', pilotSignup);
document.getElementById('pilot-logout-btn').addEventListener('click', function () {
  var name = activePilot();
  if (name) snapshotProgress(name);
  localStorage.removeItem(SESSION_SLOT);
  PROGRESS_SLOTS.forEach(function (k) { localStorage.removeItem(k); }); // guest gets a clean desk
  location.reload();
});

// autosave active pilot's progress every 60s
setInterval(function () {
  var name = activePilot();
  if (name && !document.hidden) snapshotProgress(name);
}, 60000);
renderPilotHud();
