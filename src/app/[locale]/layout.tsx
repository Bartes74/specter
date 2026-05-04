import type { Metadata, Viewport } from 'next';
import { Manrope, Fraunces, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import '../globals.css';

// Body sans — Manrope (geometric, ciepły, charakterystyczne 'a' / 'g' / 'M')
const sans = Manrope({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
});

// Display serif — Fraunces (variable: weight + opsz + SOFT + WONK; dramatyczny italic)
const display = Fraunces({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-display',
  style: ['normal', 'italic'],
  axes: ['SOFT', 'WONK', 'opsz'],
});

// Mono — JetBrains Mono (technika: ścieżki, kody, numeracja kroków)
const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Spec Generator',
    template: '%s · Spec Generator',
  },
  description: 'Generuj specyfikacje projektów dla narzędzi AI w prostych krokach.',
  applicationName: 'Spec Generator',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf7f0' },
    { media: '(prefers-color-scheme: dark)', color: '#12110f' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;

  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  setRequestLocale(locale as AppLocale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={cn(sans.variable, display.variable, mono.variable)}
      suppressHydrationWarning
    >
      <head>
        {/* Inline script — ustaw motyw przed pierwszym renderem (bez FOUC) */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function() {
              try {
                var saved = localStorage.getItem('spec-generator-theme') || 'system';
                var resolved = saved === 'system'
                  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                  : saved;
                if (resolved === 'dark') document.documentElement.classList.add('dark');
              } catch (e) {}
            })();
          `}
        </Script>
      </head>
      <body className="min-h-screen bg-bg text-ink antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
