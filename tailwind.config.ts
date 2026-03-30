import type { Config } from 'tailwindcss';

export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#09090b',
          1: '#0c0d10',
          2: '#111316',
          3: '#171a1f',
          4: '#1d2027'
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.06)',
          subtle: 'rgba(255, 255, 255, 0.04)',
          strong: 'rgba(255, 255, 255, 0.10)'
        },
        accent: {
          DEFAULT: '#2dd4a8',
          dim: 'rgba(45, 212, 168, 0.10)',
          muted: 'rgba(45, 212, 168, 0.20)',
          strong: '#5eead4'
        },
        text: {
          primary: '#e4e4e7',
          secondary: '#a1a1aa',
          muted: '#71717a',
          faint: '#52525b'
        }
      },
      fontFamily: {
        sans: ['"Outfit"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        panel: '16px',
        card: '12px',
        control: '8px'
      },
      boxShadow: {
        panel: '0 16px 64px rgba(0, 0, 0, 0.40)',
        'panel-lg': '0 24px 80px rgba(0, 0, 0, 0.50)',
        glow: '0 0 24px rgba(45, 212, 168, 0.08)'
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out both',
        'slide-up': 'slideUp 0.4s ease-out both',
        'slide-in-left': 'slideInLeft 0.3s ease-out both'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        }
      }
    }
  },
  plugins: []
} satisfies Config;
