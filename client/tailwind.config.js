/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tb: {
          bg: '#1a1a1a',
          card: '#353535',
          'card-inner': '#B6B6B6',
          surface: '#2a2a2a',
        },
        primary: {
          50: '#e8f4f8',
          100: '#cce5ef',
          200: '#99cce0',
          300: '#66b2d0',
          400: '#4792C0',
          500: '#205A74',
          600: '#1b4d64',
          700: '#00568c',
          800: '#143d4e',
          900: '#0c2a36',
        },
        accent: {
          blue: '#0ea5e9',
          green: '#3CA444',
          'green-cta': '#059669',
          amber: '#D39340',
          gold: '#9c814e',
        },
        status: {
          'active-bg': '#dcfce7',
          'active-text': '#166534',
          'expired-bg': '#eec7c7',
          'expired-text': '#832d2d',
          'warn-bg': '#fef3c7',
          'warn-text': '#92400e',
          'info-bg': '#dbeafe',
          'info-text': '#1e40af',
          'critical-bg': '#8a3333',
          'role-bg': '#3C4C7D',
        },
      },
    },
  },
  plugins: [],
};
