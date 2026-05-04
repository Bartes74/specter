import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type AppLocale } from './routing';

/**
 * Konfiguracja next-intl dla serwerowych komponentów Next.js.
 * Wczytuje pliki tłumaczeń z /messages/<locale>.json.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: AppLocale = (
    routing.locales as readonly string[]
  ).includes(requested ?? '')
    ? (requested as AppLocale)
    : routing.defaultLocale;

  try {
    const messages = (await import(`../../messages/${locale}.json`)).default;
    return {
      locale,
      messages,
      timeZone: 'Europe/Warsaw',
    };
  } catch {
    notFound();
  }
});
