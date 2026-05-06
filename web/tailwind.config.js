/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8b5cf6',
        'primary-hover': '#7c3aed',
        'bg-base': '#0f1115',
        'bg-surface': 'rgba(30, 33, 40, 0.7)',
        'bg-elevated': 'rgba(45, 49, 58, 0.8)',
        'text-main': '#f8fafc',
        'text-muted': '#94a3b8',
      },
    },
  },
  plugins: [],
}
