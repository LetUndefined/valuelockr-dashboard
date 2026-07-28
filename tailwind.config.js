/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#0a0a0a',
        surface: '#111111',
        card:    '#161616',
        elevated:'#1e1e1e',
        border:  '#1e1e1e',
        text:    '#ffffff',
        sub:     '#777777',
        muted:   '#555555',
        green:   '#00e676',
        'green-dim': '#00c46a',
        amber:   '#fbbf24',
        price:   '#7aa8c7',
        red:     '#ef4444',
        orange:  '#f97316',
      },
    },
  },
  plugins: [],
}
