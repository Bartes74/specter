import { setRequestLocale } from 'next-intl/server';
import { WizardFlow } from '@/components/WizardFlow';
import type { AppLocale } from '@/i18n/routing';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  return <WizardFlow locale={locale as AppLocale} />;
}
