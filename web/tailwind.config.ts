import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FAFAF5",
        surface: "#FFFFFF",
        foreground: "#1C1917",
        body: "#57534E",
        muted: "#78716C",
        "muted-dark": "#57534E",
        accent: "#B91C1C",
        "accent-hover": "#991B1B",
        teal: "#0F766E",
        "teal-hover": "#0D6560",
        rule: "#D6D3D1",
        "rule-light": "#E7E5E4",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "Helvetica Neue", "Arial", "sans-serif"],
        serif: ["var(--font-merriweather)", "Georgia", "Times New Roman", "serif"],
        headline: ["var(--font-playfair)", "Georgia", "serif"],
        subhead: ["var(--font-lora)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains)", "Menlo", "monospace"],
      },
      borderRadius: {
        DEFAULT: "2px",
      },
      animation: {
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
};
export default config;
