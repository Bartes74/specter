/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Aplikacja jest uruchamiana lokalnie (localhost) — pełny dostęp do Node.js API w API Routes
  typedRoutes: true,
  // Wykluczamy testy z buildu produkcyjnego
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['src/app', 'src/components', 'src/lib', 'src/services', 'src/i18n', 'src/types', 'src/middleware.ts'],
  },
};

module.exports = withNextIntl(nextConfig);
