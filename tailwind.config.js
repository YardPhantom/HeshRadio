/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        hesh: {
          void: '#05080c',
          panel: '#0b1119',
          elevated: '#111a26',
          border: 'rgba(148, 163, 184, 0.14)',
          glow: 'rgba(34, 211, 238, 0.35)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Chakra Petch', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
