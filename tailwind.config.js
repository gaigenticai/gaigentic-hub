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
        body: ["Open Sans", "system-ui", "sans-serif"],
        sans: ["Open Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
