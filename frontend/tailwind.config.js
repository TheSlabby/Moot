/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // palette is theme-driven via CSS variables (see index.css)
        rail:     "var(--rail)",
        sidebar:  "var(--sidebar)",
        chat:     "var(--chat)",
        chatInput:"var(--chatInput)",
        hover:    "var(--hover)",
        active:   "var(--active)",
        blurple:  "var(--accent)",
        blurpleHover: "var(--accentHover)",
        online:   "var(--online)",
        idle:     "var(--idle)",
        danger:   "var(--danger)",
        textNormal:"var(--textNormal)",
        textMuted: "var(--textMuted)",
        textFaint: "var(--textFaint)",
        divider:  "var(--divider)",
      },
      fontFamily: {
        sans: ['"gg sans"', "Inter", "system-ui", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
