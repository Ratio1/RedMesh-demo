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
          primary: '#d62828',
          secondary: '#0a0a0a'
        }
      },
      boxShadow: {
        floating: '0 40px 120px rgba(0,0,0,0.08)'
      }
    }
  },
  plugins: []
};

export default config;
