/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // A warm, editorial palette: paper background, ink type, one accent.
        paper: '#FAF9F6',
        ink: {
          DEFAULT: '#1C1917',
          soft: '#57534E',
          faint: '#A8A29E',
        },
        accent: {
          DEFAULT: '#6D28D9',
          strong: '#5B21B6',
          tint: '#F3EEFB',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 25, 23, 0.05), 0 8px 24px -16px rgba(28, 25, 23, 0.18)',
        'card-hover': '0 2px 4px rgba(28, 25, 23, 0.06), 0 16px 40px -16px rgba(28, 25, 23, 0.24)',
        pop: '0 12px 32px -8px rgba(109, 40, 217, 0.45)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'fade-in': 'fade-in 0.3s ease-out both',
      },
    },
  },
  plugins: [],
};
