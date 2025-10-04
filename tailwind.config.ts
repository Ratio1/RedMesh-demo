import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}', './lib/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: {
          primary: '#38bdf8',
          secondary: '#0ea5e9'
        }
      },
      boxShadow: {
        floating: '0 40px 120px rgba(8,47,73,0.45)'
      }
    }
  },
  plugins: []
};

export default config;
