import type { Config } from 'tailwindcss';

export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        canvas: '#f4f1ea',
        accent: '#0f766e',
        sand: '#e7dcc8'
      },
      boxShadow: {
        panel: '0 18px 60px rgba(15, 23, 42, 0.12)'
      },
      fontFamily: {
        sans: ['"Avenir Next"', '"Segoe UI Variable"', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config;

