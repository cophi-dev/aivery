/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    'ease-[cubic-bezier(0.34,1.56,0.64,1)]'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)"],
      },
      screens: {
        'xs': '480px',
      },
      keyframes: {
        'gentle-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(5px, 10px) rotate(2deg)' },
          '50%': { transform: 'translate(10px, 0) rotate(0deg)' },
          '75%': { transform: 'translate(5px, -10px) rotate(-2deg)' },
        },
        'float-medium': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(-8px, 8px) rotate(-3deg)' },
          '50%': { transform: 'translate(-16px, 0) rotate(0deg)' },
          '75%': { transform: 'translate(-8px, -8px) rotate(3deg)' },
        },
        'float-fast': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(3px, 6px) rotate(3deg)' },
          '50%': { transform: 'translate(6px, 0) rotate(0deg)' },
          '75%': { transform: 'translate(3px, -6px) rotate(-3deg)' },
        },
        appear: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "appear-zoom": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        }
      },
      animation: {
        'float': 'gentle-float 6s ease-in-out infinite',
        'float-slow': 'float-slow 18s ease-in-out infinite',
        'float-medium': 'float-medium 12s ease-in-out infinite',
        'float-fast': 'float-fast 8s ease-in-out infinite',
        appear: "appear 0.5s ease-out forwards",
        "appear-zoom": "appear-zoom 0.5s ease-out forwards"
      },
      colors: {
        brand: "hsl(var(--brand))",
        "brand-foreground": "hsl(var(--brand-foreground))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        strava: "#FC4C02",
        'brand-accent': '#FFA07A',
        'brand-accent-hover': '#FF8C61',
        'brand-blue': '#58a3ff',
        'brand-lightblue': '#c0daff',
        'brand-orange': '#fa9f7b',
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
      },
      maxWidth: {
        container: "1200px"
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
}; 