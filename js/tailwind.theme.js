/* OmniTradeX // Tailwind CDN theme tokens */
tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        /* Typography refactor: unified professional financial UI stack */
        orbitron: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        techmono: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        inter: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        /* Professional terminal palette: deep flat surfaces, restrained accents */
        void: '#05070d',
        panel: '#0a0f1a',
        paneldeep: '#070b14',
        neoncyan: '#22d3ee',
        neongreen: '#4ade80',
        neonmagenta: '#e879f9',
        neonamber: '#fbbf24',
        neonred: '#f87171',
        gridline: '#1a2334',
      },
    },
  },
};
