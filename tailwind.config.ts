import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        "muted-foreground": "rgb(var(--muted-foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          gold: "rgb(var(--accent-gold) / <alpha-value>)",
        },
        destructive: "rgb(var(--destructive) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "story-progress": {
          "0%": { width: "0%" },
          "100%": { width: "100%" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "story-progress": "story-progress linear forwards",
        "fade-in": "fade-in 200ms ease-out",
        "slide-up": "slide-up 250ms ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
      backgroundImage: {
        "story-ring":
          "conic-gradient(from 180deg at 50% 50%, #2563EB 0deg, #14B8A6 120deg, #2563EB 240deg, #14B8A6 360deg)",
        "fi-hero": "linear-gradient(135deg, #2563EB 0%, #14B8A6 100%)",
        "fi-card": "linear-gradient(145deg, rgba(37,99,235,0.08) 0%, rgba(20,184,166,0.06) 100%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
