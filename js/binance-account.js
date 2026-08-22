'use strict';
/* OmniTradeX // Binance account UX. Secrets never enter this browser app. */
(function () {
  var status = document.getElementById('account-status');
  var form = document.getElementById('account-form');
  function render(text, cls) { if (status) { status.textContent = text; status.className = 'font-techmono text-[10px] ' + (cls || 'text-slate-500'); } }
  window.otxAccount = { state: 'NOT_CONNECTED', begin: function () { render('SERVER ROUTE REQUIRED // READ-ONLY INTENT', 'text-neonamber'); var note = document.getElementById('account-note'); if (note) note.textContent = 'Secure Binance account connection is staged. Private keys must be entered only through the future Neon-backed server route; live orders remain disabled.'; } };
  if (form) form.addEventListener('submit', function (e) { e.preventDefault(); window.otxAccount.begin(); });
}());
