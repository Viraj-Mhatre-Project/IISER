/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0C10',
        card: '#161921',
        primary: '#3B82F6',
        success: '#10B981',
        danger: '#F43F5E',
        warning: '#F59E0B',
        muted: '#262933',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
