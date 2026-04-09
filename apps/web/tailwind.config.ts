import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        velya: {
          bg: '#0a0f1a',
          surface: '#111827',
          card: '#1a2332',
          border: '#1e293b',
          primary: '#3b82f6',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
          text: '#f8fafc',
          muted: '#94a3b8',
          subtle: '#64748b',
        },
      },
    },
  },
  plugins: [],
};
export default config;
