/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#0D9488", dark: "#2DD4BF" },
        danger: { DEFAULT: "#DC2626", dark: "#F87171" },
        warning: { DEFAULT: "#D97706", dark: "#FBBF24" },
        success: { DEFAULT: "#16A34A", dark: "#4ADE80" },
      },
    },
  },
  plugins: [],
};
