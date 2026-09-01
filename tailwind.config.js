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
          50: '#edfdf6',
          100: '#d7f7e9',
          200: '#b6eed7',
          300: '#8ae0bd',
          400: '#5acaa0',
          500: '#1fa76d',
          600: '#138d5e',
          700: '#0e704d',
          800: '#0d5a40',
          900: '#0b4b38',
        },
        accent: {
          50: '#f4fbf7',
          100: '#e3f7ed',
          200: '#cfeee1',
          300: '#bbdfcf',
          400: '#97d2b4',
          500: '#74c39d',
          600: '#5bb08a',
          700: '#448f70',
          800: '#326d58',
          900: '#295844',
        },
        dark: {
          bg: '#f5f1ea',
          card: '#ffffff',
          border: 'rgba(16, 53, 42, 0.12)',
          text: '#17392f',
          muted: '#60756f'
        }
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 40px rgba(16, 53, 42, 0.08)',
      },
    },
  },
  plugins: [],
}
