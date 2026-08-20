import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // shadcn semantic tokens (HSL via CSS vars)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Competency level colors
        lvl: {
          xs: '#64748B',
          s: '#0EA5E9',
          m: '#10B981',
          l: '#8B5CF6',
        },
        // Categorical scale — for things that must READ AS DIFFERENT from
        // each other (node type, competency level, skill category). NOT for
        // brand or interaction: that is `primary`. NOT for success/warning/
        // danger: emerald/amber/red keep those meanings.
        //
        // Declared once in globals.css as `--hue-N` (HSL triplets, with dark
        // overrides). `<alpha-value>` is what makes `bg-hue-1/10` and
        // `ring-hue-2/20` resolve — the exact shapes components were faking
        // with `bg-cyan-500/10` before. guard-no-adhoc-color.ts enforces it.
        hue: {
          1: 'hsl(var(--hue-1) / <alpha-value>)',
          2: 'hsl(var(--hue-2) / <alpha-value>)',
          3: 'hsl(var(--hue-3) / <alpha-value>)',
          4: 'hsl(var(--hue-4) / <alpha-value>)',
          5: 'hsl(var(--hue-5) / <alpha-value>)',
        },
        // Gamification
        xp: '#F59E0B',
        streak: '#F97316',
        heart: '#EF4444',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        // `var(--font-emoji)` closes every stack: the Geist/Outfit/JetBrains
        // webfonts carry no emoji glyphs, so without it a data-driven emoji
        // (workspace icon, node-type override) renders as a tofu box.
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif', 'var(--font-emoji)'],
        mono: ['var(--font-geist-mono)', 'monospace', 'var(--font-emoji)'],
        emoji: ['var(--font-emoji)', 'sans-serif'],
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #22D3EE 0%, #8B5CF6 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 120ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
