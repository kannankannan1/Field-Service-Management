/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dce7fd',
          200: '#c0d4fc',
          300: '#95b8f9',
          400: '#6292f4',
          500: '#3d6dee',
          600: '#274ee3',
          700: '#1f3cd1',
          800: '#1f34aa',
          900: '#1e3086',
        },
      },
    },
  },
  plugins: [],
};
