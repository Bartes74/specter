'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from './ui/Icon';
import { SegmentedControl } from './ui/SegmentedControl';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'spec-generator-theme';

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  root.classList.toggle('dark', resolved === 'dark');
}

/**
 * ThemeToggle — segmentowy radio Light / System / Dark (zamiast cyklicznego buttona).
 * Bardziej user-friendly: użytkownik widzi stan i alternatywy bez klikania.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system';
    setTheme(saved);
    applyTheme(saved);
    setMounted(true);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if ((localStorage.getItem(STORAGE_KEY) as Theme | null) === 'system') {
        applyTheme('system');
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const change = (next: Theme) => {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  // Avoid SSR hydration mismatch — render placeholder until mounted
  if (!mounted) {
    return <div className="h-8 w-[7.5rem]" aria-hidden />;
  }

  return (
    <SegmentedControl<Theme>
      ariaLabel="Motyw"
      size="sm"
      value={theme}
      onChange={change}
      options={[
        { value: 'light',  label: 'Jasny',  icon: <Sun size={12} /> },
        { value: 'system', label: 'Auto',   icon: <Monitor size={12} /> },
        { value: 'dark',   label: 'Ciemny', icon: <Moon size={12} /> },
      ]}
    />
  );
}
