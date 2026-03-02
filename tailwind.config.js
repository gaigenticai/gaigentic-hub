/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Ink — warm gray neutral scale (the Ledger palette)
        ink: {
          950: "#0C0C0E",
          900: "#1A1A1F",
          800: "#2C2C33",
          700: "#3D3D47",
          600: "#52525E",
          500: "#6B6B78",
          400: "#8E8E9A",
          300: "#B0B0BA",
          200: "#D1D1D8",
          100: "#E8E8EC",
          50: "#F4F4F6",
          25: "#FAFAFB",
        },
        // CTA orange (brand)
        cta: {
          DEFAULT: "#FF7A00",
          hover: "#E56A00",
          light: "#FFF3E6",
          ring: "rgba(255, 122, 0, 0.2)",
        },
        // Cobalt secondary
        cobalt: {
          DEFAULT: "#0052CC",
          hover: "#003D99",
          light: "#E8F0FE",
          ring: "rgba(0, 82, 204, 0.2)",
        },
        // Signal colors (semantic, surgical use)
        signal: {
          green: "#0D7C3F",
          "green-light": "#E6F4EC",
          red: "#C9190B",
          "red-light": "#FCECEA",
          amber: "#B25000",
          "amber-light": "#FFF4E6",
        },
        // Brand red (logo only)
        "brand-red": "#E63226",
      },
      fontFamily: {
        headline: ["Montserrat", "system-ui", "sans-serif"],
        body: ["Inter", "Open Sans", "system-ui", "sans-serif"],
        sans: ["Inter", "Open Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        xl: "1rem",
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      boxShadow: {
        "premium-sm": "0 2px 8px -2px rgba(12, 12, 14, 0.05), 0 4px 12px -4px rgba(12, 12, 14, 0.05)",
        "premium-md": "0 4px 16px -4px rgba(12, 12, 14, 0.05), 0 8px 24px -8px rgba(12, 12, 14, 0.05)",
        "premium-lg": "0 8px 24px -4px rgba(12, 12, 14, 0.08), 0 16px 32px -12px rgba(12, 12, 14, 0.08)",
        "premium-inset": "inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)",
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'conic-gradient(from 180deg at 50% 50%, #FF7A0033 0deg, #E6322633 180deg, #FF7A0033 360deg)',
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out forwards",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
