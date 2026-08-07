/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#101114",
        panel: "#17191f",
        border: "#2a2e37",
        ink: "#f4f7fb",
        muted: "#9ba4b5",
        accent: "#57c7ff",
        success: "#49d17d",
        warning: "#f8c14a",
        danger: "#ff5c7a"
      }
    }
  },
  plugins: []
};
