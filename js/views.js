'use strict';
/* OmniTradeX Engine // module: views — load order matters, see index.html */

/* ---------------- VIEW SWITCHER: Terminal / Intel / Arena / Mentor ---------------- */
var VIEWS = {
  terminal: { nav: document.getElementById('nav-terminal'), el: document.getElementById('view-terminal'), accent: 'neoncyan' },
  intel:    { nav: document.getElementById('nav-intel'),    el: document.getElementById('view-intel'),    accent: 'neonamber' },
  arena:    { nav: document.getElementById('nav-arena'),    el: document.getElementById('view-arena'),    accent: 'neonmagenta' },
  mentor:   { nav: document.getElementById('nav-mentor'),   el: document.getElementById('view-mentor'),   accent: 'neongreen' },
  replay:   { nav: document.getElementById('nav-replay'),   el: document.getElementById('view-replay'),   accent: 'neonamber' },
  journal:  { nav: document.getElementById('nav-journal'),  el: document.getElementById('view-journal'),  accent: 'neoncyan' }
};

function switchView(name) {
  Object.keys(VIEWS).forEach(function (k) {
    var v = VIEWS[k];
    var on = k === name;
    v.el.classList.toggle('hidden', !on);
    v.el.classList.toggle('flex', on && k !== 'terminal');
    v.nav.className = 'font-orbitron text-[10px] tracking-widest uppercase rounded-sm px-3 py-2 border ' +
      (on ? 'border-' + v.accent + ' text-' + v.accent + ' bg-' + v.accent + '/10'
          : 'border-gridline text-slate-500 hover:text-' + v.accent + ' hover:border-' + v.accent + '/40');
    if (on) v.nav.setAttribute('aria-current', 'page'); else v.nav.removeAttribute('aria-current');
  });
  if (name === 'intel' && !newsItems.length) refreshNews();
  if (name === 'arena') { renderArena(); renderDesk(); }
  if (name === 'journal') renderJournal();
  if (name === 'replay') {
    sizeReplayCanvas();
    if (replay.data.length) drawReplay();
  }
}
Object.keys(VIEWS).forEach(function (k) {
  VIEWS[k].nav.addEventListener('click', function () { switchView(k); });
});

/* ---------------- PAGE VISIBILITY: pause background work ---------------- */
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    if (state.forexTimer) { clearInterval(state.forexTimer); state.forexTimer = null; }
  } else {
    startForexEngine();
    renderActive(); // repaint with freshest data on return
  }
});
