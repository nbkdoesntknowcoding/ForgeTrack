// tailwind.config.js — neo-brutalist dark gaming theme
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void:    '#07090C',
        canvas:  '#0A0E14',
        surface: {
          DEFAULT: '#11161E',
          raised:  '#161D27',
          inset:   '#0D1218',
        },
        border: {
          subtle:  '#1F2A36',
          default: '#2A3A4A',
          strong:  '#4A5C70',
        },
        fg: {
          primary:   '#E8FFE3',
          secondary: '#8FA29E',
          tertiary:  '#4A5560',
        },
        accent: {
          glow: '#39FF14',
        },
        cyber: {
          green:  '#39FF14',
          pink:   '#FF2D9F',
          blue:   '#00B7FF',
          yellow: '#FFC42B',
        },
        success: { DEFAULT: '#39FF14', bg: 'rgba(57,255,20,0.10)',  border: 'rgba(57,255,20,0.40)' },
        danger:  { DEFAULT: '#FF2D9F', bg: 'rgba(255,45,159,0.10)', border: 'rgba(255,45,159,0.40)' },
        warning: { DEFAULT: '#FFC42B', bg: 'rgba(255,196,43,0.10)', border: 'rgba(255,196,43,0.40)' },
        info:    { DEFAULT: '#00B7FF', bg: 'rgba(0,183,255,0.10)',  border: 'rgba(0,183,255,0.40)' },
      },
      fontFamily: {
        display: ['JetBrains Mono', 'Satoshi', 'Inter', 'system-ui', 'monospace'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      fontSize: {
        'display-hero': ['4.5rem', { lineHeight: '1.0',  letterSpacing: '-0.03em',  fontWeight: '700' }],
        'display-lg':   ['3.5rem', { lineHeight: '1.0',  letterSpacing: '-0.025em', fontWeight: '700' }],
        'display-md':   ['2.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em',  fontWeight: '700' }],
        'display-sm':   ['2rem',   { lineHeight: '1.1',  letterSpacing: '-0.015em', fontWeight: '700' }],
        'label':        ['0.6875rem', { lineHeight: '1.3', letterSpacing: '0.10em', fontWeight: '600' }],
        'micro':        ['0.625rem',  { lineHeight: '1.2', letterSpacing: '0.08em', fontWeight: '600' }],
      },
      borderRadius: {
        'xl':  '0.5rem',    // 8px (down from 18px)
        '2xl': '0.625rem',  // 10px (down from 24px)
      },
      borderWidth: {
        '3': '3px',
      },
      boxShadow: {
        'brut-sm':   '3px 3px 0 #000',
        'brut':      '6px 6px 0 #000',
        'brut-lg':   '8px 8px 0 #000',
        'brut-glow': '6px 6px 0 #39FF14',
        'brut-pink': '6px 6px 0 #FF2D9F',
        'brut-blue': '6px 6px 0 #00B7FF',
      },
      backgroundImage: {
        'cosmic-glow': 'radial-gradient(ellipse 800px 400px at 50% -200px, rgba(57,255,20,0.10), rgba(57,255,20,0) 60%)',
        'card-gradient': 'none',
        'dot-grid': 'radial-gradient(rgba(57,255,20,0.06) 1px, transparent 1px)',
        'crt-scanlines': 'repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,255,255,0.03) 2px 3px)',
      },
      backgroundSize: {
        'dot-grid': '24px 24px',
      },
    },
  },
};
