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
        // Obsidian kept for legacy canvas scenes (Cesium/Leaflet dark basemap)
        obsidian: {
          950: "#0B0F19",
          900: "#0E1424",
          800: "#121926",
          700: "#1A2333",
          600: "#222F45",
        },
        // Everforest — landing page aesthetic
        forest: {
          deep: "#1e2528",
          dim: "#272e33",
          0: "#2d353b",
          1: "#343f44",
          2: "#3d484d",
          3: "#475258",
          4: "#4f585e",
        },
        pine: "#d3c6aa",
        pineGrey: "#859289",
        pineMist: "#9daaa4",
        everRed: "#e67e80",
        everOrange: "#e69875",
        everYellow: "#dbbc7f",
        everGreen: "#a7c080",
        everAqua: "#83c092",
        everBlue: "#7fbbb3",
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
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
        display: ['"Space Grotesk"', "sans-serif"],
        serif: ['"Times New Roman"', "Times", "Georgia", "serif"],
      },
      borderWidth: {
        1: "1px",
      },
    },
  },
  plugins: [],
};

export default config;
