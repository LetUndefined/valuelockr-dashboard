/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#0d0f1e',
        surface: '#13152a',
        card:    '#1a1d35',
        border:  '#2a2d4a',
        text:    '#c8cae0',
        muted:   '#6b6e8a',
        heading: '#e8eaf8',
        gold:    '#c9950f',
        steel:   '#4a7fa0',
        accent:  '#5a6fff',
      },
    },
  },
  plugins: [],
}
