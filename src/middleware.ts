import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Middleware obsługujące locale: wykrywanie języka w URL,
 * przekierowanie do domyślnego (pl) jeśli nie podany.
 */
export default createMiddleware(routing);

export const config = {
  // Pomijamy ścieżki API, plików statycznych i wewnętrznych Next.js
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
