import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT: "#B8935A", light: "#D4AA78", pale: "#F5EDE0" },
        ink: { DEFAULT: "#111111", light: "#444444", muted: "#777777" },
        cream: { DEFAULT: "#FAF8F4", dark: "#F0EBE1" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-cormorant)", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
