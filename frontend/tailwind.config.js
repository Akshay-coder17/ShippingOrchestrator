/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#050d1a",
        "bg-card": "rgba(10, 25, 50, 0.7)",
        "accent": "#00d4ff",
        "accent-green": "#00ff88",
        "accent-orange": "#ff6b35",
        "text-primary": "#e8f4fd",
        "border": "rgba(0, 212, 255, 0.15)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite",
      },
      keyframes: {
        glow: {
          "0%, 100%": { opacity: 1, "text-shadow": "0 0 10px #00d4ff" },
          "50%": { opacity: 0.8, "text-shadow": "0 0 20px #00d4ff" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
