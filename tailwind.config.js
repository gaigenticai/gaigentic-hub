/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary brand — purple-blue gradient system (matches gaigentic.ai)
        brand: {
          50: "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a855f7",
          600: "#9333ea",
          700: "#7c3aed",
          800: "#6b21b6",
          900: "#581c87",
        },
        // CTA orange (matches gaigentic.ai)
        cta: {
          DEFAULT: "#FF7A00",
          hover: "#E56A00",
        },
        // Cobalt secondary CTA
        cobalt: {
          DEFAULT: "#0052CC",
          hover: "#003d99",
        },
        // Gradient helpers
        "gradient-start": "#6366f1",
        "gradient-middle": "#8b5cf6",
        "gradient-end": "#a855f7",
      },
      fontFamily: {
        headline: ["Montserrat", "system-ui", "sans-serif"],
        body: ["Open Sans", "system-ui", "sans-serif"],
        sans: ["Open Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.625rem",
        sm: "0.5rem",
      },
      animation: {
        "fade-in-up": "fadeInUp 0.8s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(139, 92, 246, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(139, 92, 246, 0.6)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200px 0" },
          "100%": { backgroundPosition: "calc(200px + 100%) 0" },
        },
      },
      boxShadow: {
        "glow-sm": "0 0 10px rgba(139, 92, 246, 0.3)",
        "glow-md": "0 0 20px rgba(139, 92, 246, 0.4)",
      },
    },
  },
  plugins: [],
};
