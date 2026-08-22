'use strict';
/* OmniTradeX // Binance account UX. Secrets never enter this browser app. */
(function () {
  var status = document.getElementById('account-status');
  var form = document.getElementById('account-form');
  function render(text, cls) { if (status) { status.textContent = text; status.className = 'font-techmono text-[10px] ' + (cls || 'text-slate-500'); } }
  var state = 'NOT_CONNECTED';
  function begin() {
    state = 'SERVER_REQUIRED';
    render('SERVER ROUTE REQUIRED // READ-ONLY INTENT', 'text-neonamber');
    var note = document.getElementById('account-note');
    if (note) note.textContent = 'Secure Binance account connection is staged. Do not enter API keys here. A future Neon-backed server route will use encrypted, read-only credentials; live orders remain disabled.';
    window.dispatchEvent(new CustomEvent('otx:account-status', { detail: { state: state, capability: 'READ_ONLY_PENDING' } }));
  }
  window.otxAccount = { get state() { return state; }, begin: begin, disconnect: function () { state = 'NOT_CONNECTED'; render('NOT CONNECTED // NO CREDENTIALS STORED', 'text-slate-500'); } };
  if (form) form.addEventListener('submit', function (e) { e.preventDefault(); window.otxAccount.begin(); });
}());
