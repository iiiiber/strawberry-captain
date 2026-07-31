/** @type {import('tailwindcss').Config} */
// xiaoana 1:1 复刻 — Tailwind config · 商用色板版本
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 商用品品牌色 (与 index.css :root CSS 变量一致)
        canvas: '#F6F7F9',
        card: '#FFFFFF',
        border: '#E2E8F0',
        primary: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          400: '#3B82F6',
          500: '#1E3A5F',
          600: '#16314F',
          700: '#0F2540',
        },
        text: {
          primary: '#0F172A',
          secondary: '#475569',
          muted: '#94A3B8',
        },
        brand: {
          DEFAULT: '#1E3A5F',
          accent: '#E83E5B',
          success: '#059669',
          warning: '#D97706',
          info: '#2563EB',
        },
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
        pill: '999px',
        xl2: '14px',
        '2xl': '16px',
        '3xl': '24px',
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Microsoft YaHei"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,0.04)',
        md: '0 4px 16px rgba(15,23,42,0.08)',
        lg: '0 12px 32px rgba(15,23,42,0.10)',
      },
    },
  },
  plugins: [],
};
