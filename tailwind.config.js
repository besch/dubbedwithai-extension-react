/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(222.2 84% 4.9%)",
        foreground: "hsl(210 40% 98%)",
        primary: {
          DEFAULT: "hsl(210, 100%, 50%)",
          foreground: "hsl(0, 0%, 100%)",
        },
        secondary: {
          DEFAULT: "hsl(280, 100%, 50%)",
          foreground: "hsl(0, 0%, 100%)",
        },
        destructive: {
          DEFAULT: "hsl(0, 62.8%, 30.6%)",
          foreground: "hsl(210 40% 98%)",
        },
        accent: {
          DEFAULT: "hsl(216, 34%, 17%)",
          foreground: "hsl(210 40% 98%)",
        },
        muted: {
          DEFAULT: "hsl(217.2 32.6% 17.5%)",
          foreground: "hsl(215 20.2% 65.1%)",
        },
        border: "hsl(217.2 32.6% 17.5%)",
        input: "hsl(217.2 32.6% 17.5%)",
        ring: "hsl(212.7 26.8% 83.9%)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        flashBlueRed: {
          "0%, 100%": { color: "hsl(var(--primary))" },
          "50%": { color: "hsl(var(--destructive))" },
        },
        flashRed: {
          "0%, 100%": { color: "hsl(var(--destructive))" },
          "50%": { color: "hsl(var(--background))" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        spin: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "flash-blue-red": "flashBlueRed 1s linear infinite",
        "flash-red": "flashRed 1s linear infinite",
        "fade-in": "fadeIn 0.3s ease-in",
        spin: "spin 1s linear infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
