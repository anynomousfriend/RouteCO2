import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: "#0B0F19",
          900: "#0E1424",
          800: "#121926",
          700: "#1A2333",
          600: "#222F45",
        },
        indigo: {
          400: "#6B7FF5",
          500: "#4C63ED",
          600: "#3B50DB",
          700: "#2E3FB8",
        },
        cyan: {
          400: "#22D3EE",
          500: "#06B6D4",
        },
        amber: {
          400: "#FBBF24",
          500: "#F59E0B",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
