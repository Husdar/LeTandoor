/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#FAF3E7",
          dark: "#F0E6D2",
        },
        gold: {
          DEFAULT: "#C9A227",
          light: "#E0C463",
          dark: "#9C7D1E",
        },
        burgundy: {
          DEFAULT: "#6E1423",
          light: "#8C1B2E",
          dark: "#4A0D18",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Playfair Display", "serif"],
      },
    },
  },
  plugins: [],
};
