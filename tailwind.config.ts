import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "Noto Sans SC", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      colors: {
        bg: {
          main: "#fafaf9",
          rail: "#edece9",
          panel: "#f5f4f2",
          card: "#ffffff",
        },
        bubble: {
          ai: "#f5f4f2",
          user: "#1a1a1a",
        },
        selected: "#e2dfda",
        hover: "#eae8e4",
        border: {
          DEFAULT: "#e8e5e0",
          rail: "#e0ddd8",
        },
        text: {
          primary: "#1a1a1a",
          secondary: "#737373",
          tertiary: "#a3a3a3",
        },
        semantic: {
          danger: "#ef4444",
          warning: "#d4a03c",
          success: "#22c55e",
          info: "#4a8fd4",
        },
      },
      borderRadius: {
        pill: "20px",
      },
    },
  },
  plugins: [],
};
export default config;
