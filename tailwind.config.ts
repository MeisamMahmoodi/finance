import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0b0d",
        surface: "#1c1c1f",
        border: "#232326",
        muted: "#6b6b70",
        secondary: "#8a8a8e",
        accent: "#8b8bff",
        success: "#5dcaa5",
        danger: "#e2504a",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
