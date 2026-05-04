'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter, routing, type AppLocale } from '@/i18n/routing';
import { SegmentedControl } from './ui/SegmentedControl';

/**
 * Selektor języka — premium SegmentedControl (Wymaganie 10.2).
 * Po wyborze natychmiast aktualizuje interfejs (Wymaganie 10.3).
 */
export function LanguageSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const change = (next: AppLocale) => {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <SegmentedControl<AppLocale>
      ariaLabel={t('language')}
      size="sm"
      value={locale}
      options={routing.locales.map((code) => ({
        value: code,
        label: code.toUpperCase(),
      }))}
      onChange={change}
    />
  );
}
