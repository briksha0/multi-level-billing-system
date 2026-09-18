/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf6f0',
          100: '#f9e7d4',
          200: '#f2c9a1',
          300: '#e8a56b',
          400: '#dc8242',
          500: '#c47046',
          600: '#a85a38',
          700: '#8a4730',
          800: '#6e3a2c',
          900: '#5a3126',
        },
        accent: {
          50: '#f0f7f9',
          100: '#d7e9ef',
          200: '#b0d2de',
          300: '#86b7c7',
          400: '#6aa0b3',
          500: '#7ba8b8',
          600: '#5e8a9a',
          700: '#4b6e7b',
          800: '#3e5964',
          900: '#344a53',
        },
        dark: {
          bg: '#202024',
          card: '#2a2a2f',
          border: 'rgba(232,229,223,0.12)',
          text: '#e8e5df',
          muted: '#9a978f'
        }
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
