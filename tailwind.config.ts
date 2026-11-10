module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#100638',
        teal: '#00BD98',
        'page-bg': '#F5F6F8',
        mint: '#E8F7F2',
        'border-light': '#E8E9F0',
        'teal-light': '#D1D1D8',
        'mint-border': '#B8E6DD',
        'red-light': '#FEE8E8',
        'red-error': '#E74C3C',
      },
      textColor: {
        navy: '#100638',
        'text-primary': '#100638',
        'text-secondary': '#626477',
        'red-error': '#E74C3C',
      },
      borderColor: {
        light: '#E8E9F0',
      },
    },
  },
  plugins: [],
}
