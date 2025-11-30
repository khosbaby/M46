import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#05060c',
          muted: '#0f1328',
          elevated: '#11152a',
        },
        accent: {
          sky: '#38bdf8',
          violet: '#a78bfa',
          amber: '#fbbf24',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'SFMono-Regular', 'monospace'],
      },
      backgroundImage: {
        'grid-glow':
          'radial-gradient(circle at 20% 20%, rgba(59,130,246,0.2) 0, transparent 40%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.15) 0, transparent 35%), radial-gradient(circle at 40% 90%, rgba(236,72,153,0.2) 0, transparent 45%)',
      },
      boxShadow: {
        panel: '0 30px 120px rgba(5, 6, 12, 0.55)',
      },
      borderRadius: {
        '3xl': '1.75rem',
        '4xl': '2.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
