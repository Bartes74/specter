import type { Config } from 'tailwindcss';

/**
 * "Editorial Specification" design system.
 *
 * Inspiracje:
 *  - Eleganckie czasopisma techniczne (The Type Specimen, Typography magazine)
 *  - Ręcznie składane manuskrypty (numeracja kroków w mono, jak w bibliografii)
 *  - Druk litografowany — ciepłe odcienie kremu / inku, zero sterylnej bieli
 *
 * Fonty:
 *  - Fraunces (display serif, variable opt-size + soft + wonk axis)
 *  - Manrope (body sans, geometric, ciepły)
 *  - JetBrains Mono (technical detail)
 *
 * Akcent: sienna / burnt amber — nie banalny blue, nie purple gradient.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    './content/**/*.{md,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-sans)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        display: [
          'var(--font-display)',
          'ui-serif',
          'Georgia',
          'Cambria',
          'serif',
        ],
        mono: [
          'var(--font-mono)',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem',     letterSpacing: '0.04em' }],
        xs:   ['0.75rem',   { lineHeight: '1.125rem', letterSpacing: '0.01em' }],
        sm:   ['0.8125rem', { lineHeight: '1.3rem',   letterSpacing: '0' }],
        base: ['0.9375rem', { lineHeight: '1.55rem',  letterSpacing: '-0.005em' }],
        lg:   ['1.0625rem', { lineHeight: '1.65rem',  letterSpacing: '-0.01em' }],
        xl:   ['1.25rem',   { lineHeight: '1.75rem',  letterSpacing: '-0.012em' }],
        '2xl':['1.5rem',    { lineHeight: '2rem',     letterSpacing: '-0.016em' }],
        '3xl':['2rem',      { lineHeight: '2.4rem',   letterSpacing: '-0.02em'  }],
        '4xl':['2.75rem',   { lineHeight: '3rem',     letterSpacing: '-0.024em' }],
        '5xl':['3.75rem',   { lineHeight: '4rem',     letterSpacing: '-0.028em' }],
        '6xl':['5rem',      { lineHeight: '5.25rem',  letterSpacing: '-0.034em' }],
        '7xl':['7rem',      { lineHeight: '7rem',     letterSpacing: '-0.04em'  }],
      },
      colors: {
        bg: {
          DEFAULT:  'rgb(var(--bg) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
          inset:    'rgb(var(--bg-inset) / <alpha-value>)',
          accent:   'rgb(var(--bg-accent) / <alpha-value>)',
        },
        ink: {
          DEFAULT:     'rgb(var(--ink) / <alpha-value>)',
          muted:       'rgb(var(--ink-muted) / <alpha-value>)',
          subtle:      'rgb(var(--ink-subtle) / <alpha-value>)',
          accent:      'rgb(var(--ink-accent) / <alpha-value>)',
          'on-accent': 'rgb(var(--ink-on-accent) / <alpha-value>)',
        },
        rule: {
          DEFAULT: 'rgb(var(--rule) / <alpha-value>)',
          strong:  'rgb(var(--rule-strong) / <alpha-value>)',
        },
        sienna: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover:   'rgb(var(--accent-hover) / <alpha-value>)',
          subtle:  'rgb(var(--accent-subtle) / <alpha-value>)',
        },
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        danger:  'rgb(var(--danger) / <alpha-value>)',
      },
      borderRadius: {
        none: '0',
        xs: '2px',
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px',
      },
      boxShadow: {
        hairline: '0 0 0 1px rgb(var(--rule) / 0.6)',
        xs: '0 1px 0 0 rgb(var(--shadow) / 0.04)',
        sm: '0 1px 2px 0 rgb(var(--shadow) / 0.05), 0 1px 3px 0 rgb(var(--shadow) / 0.04)',
        DEFAULT: '0 2px 4px -1px rgb(var(--shadow) / 0.06), 0 4px 8px -2px rgb(var(--shadow) / 0.04)',
        md: '0 4px 8px -2px rgb(var(--shadow) / 0.08), 0 8px 16px -4px rgb(var(--shadow) / 0.05)',
        lg: '0 8px 16px -4px rgb(var(--shadow) / 0.10), 0 16px 32px -8px rgb(var(--shadow) / 0.06)',
        xl: '0 16px 32px -8px rgb(var(--shadow) / 0.14), 0 24px 48px -12px rgb(var(--shadow) / 0.08)',
        letterpress: 'inset 0 -1px 0 0 rgb(var(--shadow) / 0.08)',
        'glow-accent': '0 0 0 4px rgb(var(--accent) / 0.18)',
        'glow-danger': '0 0 0 4px rgb(var(--danger) / 0.18)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        'spring-soft': 'cubic-bezier(0.34, 1.36, 0.64, 1)',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
        '450': '450ms',
        '600': '600ms',
      },
      animation: {
        'fade-in':    'fadeIn  300ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'rise':       'rise    450ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-r': 'slideInR 400ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-soft': 'scaleSoft 350ms cubic-bezier(0.34, 1.36, 0.64, 1) both',
      },
      keyframes: {
        fadeIn:   { from: { opacity: '0' }, to: { opacity: '1' } },
        rise:     { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInR: { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        scaleSoft:{ from: { opacity: '0', transform: 'scale(0.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};

export default config;
