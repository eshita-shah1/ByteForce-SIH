/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          forest: {
            DEFAULT: "#183D2B",
            hover: "#133122",
            dark: "#0F261B",
            light: "#23583E",
            subtle: "#EBF5F0"
          },
          mint: {
            DEFAULT: "#38A169",
            light: "#68D391",
            bg: "#E6F6ED",
            text: "#1E6B40",
            border: "#C3E6D2"
          }
        },
        slate: {
          surface: "#F8FAFC",
          panel: "#FFFFFF",
          subtle: "#F1F5F9",
          border: "#E2E8F0",
          muted: "#64748B"
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card': '0 2px 4px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.02)',
      }
    },
  },
  plugins: [],
}
