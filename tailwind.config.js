/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        island: {
          bg: 'var(--island-bg)',
          panel: 'var(--island-panel)',
          card: 'var(--island-card)',
          line: 'var(--island-line)',
          overlay: 'var(--island-overlay)',
          accent: '#22d3ee'
        }
      },
      textColor: {
        island: 'var(--island-text)',
        sub: 'var(--island-text-sub)',
        dim: 'var(--island-text-dim)',
        faint: 'var(--island-text-faint)'
      },
      fontFamily: {
        sans: ['Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        island: '26px'
      },
      transitionTimingFunction: {
        'island': 'cubic-bezier(0.32, 0.72, 0, 1)'
      }
    }
  },
  plugins: []
}
