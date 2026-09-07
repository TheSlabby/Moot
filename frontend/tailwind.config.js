/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Discord-ish dark palette
        rail:     "#1e1f22", // guild rail / darkest
        sidebar:  "#2b2d31", // channel sidebar
        chat:     "#313338", // main chat area
        chatInput:"#383a40", // composer / inputs
        hover:    "#35373c",
        active:   "#404249",
        blurple:  "#5865f2",
        blurpleHover: "#4752c4",
        online:   "#23a55a",
        idle:     "#f0b232",
        danger:   "#da373c",
        textNormal:"#dbdee1",
        textMuted: "#949ba4",
        textFaint: "#80848e",
        divider:  "#3f4147",
      },
      fontFamily: {
        sans: ['"gg sans"', "Inter", "system-ui", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
