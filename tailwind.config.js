/** @type {import('tailwindcss').Config} */
// "Inspection report" tokens. slate is remapped to cool neutrals so every existing page re-themes at once.
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      // Floor: nothing below 13px in dense tables.
      fontSize: { xs: ["0.8125rem", "1.125rem"], sm: ["0.875rem", "1.25rem"] },
      colors: {
        slate: {
          50: "#F4F6F7", 100: "#E9EDF0", 200: "#D3DAE0", 300: "#B8C2CB", 400: "#5F6B76",
          500: "#4E5A65", 600: "#3B4752", 700: "#2A3641", 800: "#1E2A35", 900: "#15212B",
        },
        action: { DEFAULT: "#1E5AA8", hover: "#174A8C", soft: "#E8EFF8" },
        sev: {
          blocker: "#B42318", "blocker-bg": "#FDECEA",
          high: "#B54708", "high-bg": "#FEF0E6",
          medium: "#8A6100", "medium-bg": "#FDF6DC",
          low: "#3D5A80", "low-bg": "#EAF0F7",
        },
      },
    },
  },
  plugins: [],
};
