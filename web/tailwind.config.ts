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
        // Minimalist Editorial Palette (Warm Monochrome + Spot Pastels)
        minimal: {
          canvas: "#FBFBFA",
          surface: "#FFFFFF",
          card: "#FFFFFF",
          border: "#EAEAEA",
          borderSubtle: "rgba(0, 0, 0, 0.06)",
          text: "#111111",
          muted: "#787774",
          subtle: "#999999",
          charcoal: "#111111",
          hover: "#2A2A2A",
          kbd: "#F7F6F3",
        },
        pastel: {
          green: "#EDF3EC",
          greenText: "#346538",
          blue: "#E1F3FE",
          blueText: "#1F6C9F",
          yellow: "#FBF3DB",
          yellowText: "#956400",
          red: "#FDEBEC",
          redText: "#9F2F2D",
        },
        // Minimalist Architectural Technical-Chic Palette
        putty: {
          DEFAULT: "#ECEBE6", // Warm canvas off-white
          canvas: "#ECEBE6",
          panel: "#D6D5CF",  // Light monochrome panel
          subtle: "#DFDED9",
          contrast: "#E3E2DC",
          paper: "#F3F2EE",
          border: "#D4D3CD",  // Razor-thin 1px border
        },
        charcoal: {
          DEFAULT: "#111111", // Matte charcoal-black
          muted: "#555555",
          faint: "#888888",
        },
        safety: {
          orange: "#FF4D00",  // Industrial safety orange action accent
          hover: "#E64A19",
          faint: "rgba(255, 77, 0, 0.12)",
        },
        // Obsidian kept for legacy canvas scenes (Leaflet dark basemap)
        obsidian: {
          950: "#0B0F19",
          900: "#0E1424",
          800: "#121926",
          700: "#1A2333",
          600: "#222F45",
        },
        // Everforest legacy tokens for backwards compatibility
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
      },
      fontFamily: {
        sans: ['"Geist"', '"SF Pro Display"', "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', '"IBM Plex Mono"', "ui-monospace", "monospace"],
        editorial: ['"Newsreader"', '"Instrument Serif"', "Georgia", "serif"],
        display: ['"Space Grotesk"', "sans-serif"],
        serif: ['"Newsreader"', '"Instrument Serif"', "Georgia", "serif"],
      },
      borderWidth: {
        1: "1px",
      },
    },
  },
  plugins: [],
};

export default config;
