import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        surface: "#f5f5f6",
        border: "#e8e8e9",
        muted: "#9a9a9d",
        secondary: "#6b6b6f",
        ink: "#111113",
        accent: "#111113",
        success: "#2f9e5b",
        danger: "#d33f3f",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
