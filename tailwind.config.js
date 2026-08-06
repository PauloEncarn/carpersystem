/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        cicopal: {
          blue: "#1E22A8",
          red: "#E30613",
          green: "#198754",
          surface: "#F8F9FA"
        }
      },
      fontFamily: {
        sans: ["Gotham", "Montserrat", "Avenir Next", "Arial", "sans-serif"]
      },
      boxShadow: {
        soft: "0 .125rem .25rem rgba(0,0,0,.075)"
      }
    }
  },
  plugins: []
};
