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
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        serif: ["var(--font-dm-serif)", "serif"],
        mono: ["var(--font-inter)", "monospace"],
        // 90s Apple inspired font stack
        system: ["SF Pro Display", "-apple-system", "BlinkMacSystemFont", "var(--font-poppins)", "system-ui", "sans-serif"],
        display: ["var(--font-dm-serif)", "SF Pro Display", "-apple-system", "serif"],
      },
      fontSize: {
        // 90s Apple inspired type scale
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['2.75rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-sm': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'heading-lg': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        'heading-md': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.005em' }],
        'heading-sm': ['1.25rem', { lineHeight: '1.35', letterSpacing: '0em' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', letterSpacing: '0em' }],
        'body-md': ['1rem', { lineHeight: '1.6', letterSpacing: '0em' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0em' }],
        'caption': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.02em' }],
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
        },
        // Minimalist animations
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'float': 'gentle-float 6s ease-in-out infinite',
        'float-slow': 'float-slow 18s ease-in-out infinite',
        'float-medium': 'float-medium 12s ease-in-out infinite',
        'float-fast': 'float-fast 8s ease-in-out infinite',
        appear: "appear 0.5s ease-out forwards",
        "appear-zoom": "appear-zoom 0.5s ease-out forwards",
        // Minimalist animations
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.6s ease-out',
      },
      colors: {
        // Minimalist 90s Apple inspired palette
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        // Enhanced sophisticated dark palette
        slate: {
          950: '#020617',
        },
        zinc: {
          950: '#09090b',
        },
        // Keep existing brand colors
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
      spacing: {
        // Minimalist spacing scale
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        // Minimalist radius scale
        'minimal': '4px',
        'subtle': '6px',
      },
      maxWidth: {
        container: "1200px"
      },
      backdropBlur: {
        'subtle': '8px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
}; 