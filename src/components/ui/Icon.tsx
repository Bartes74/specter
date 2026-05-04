/**
 * Wewnętrzna kolekcja ikon — minimalistyczny, jednolity stroke (1.5px), zaokrąglone końce.
 * Trzymamy lokalnie żeby nie ciągnąć kolejnej zależności (lucide/feather i tak miałyby ~250 KB).
 *
 * Dodawaj nowe ikony w miarę potrzeby.
 */
import type { SVGProps } from 'react';

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const Sized = ({ size = 16, ...rest }: IconProps & { children: React.ReactNode }) => (
  <svg width={size} height={size} {...baseProps} {...rest} />
);

export const ChevronRight = (p: IconProps) => (
  <Sized {...p}><path d="M9 6l6 6-6 6" /></Sized>
);
export const ChevronLeft = (p: IconProps) => (
  <Sized {...p}><path d="M15 6l-6 6 6 6" /></Sized>
);
export const ChevronDown = (p: IconProps) => (
  <Sized {...p}><path d="M6 9l6 6 6-6" /></Sized>
);
export const Check = (p: IconProps) => (
  <Sized {...p}><path d="M20 6L9 17l-5-5" /></Sized>
);
export const X = (p: IconProps) => (
  <Sized {...p}><path d="M18 6L6 18M6 6l12 12" /></Sized>
);
export const Plus = (p: IconProps) => (
  <Sized {...p}><path d="M12 5v14M5 12h14" /></Sized>
);
export const Folder = (p: IconProps) => (
  <Sized {...p}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></Sized>
);
export const FolderPlus = (p: IconProps) => (
  <Sized {...p}>
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    <path d="M12 11v6M9 14h6" />
  </Sized>
);
export const FileText = (p: IconProps) => (
  <Sized {...p}>
    <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" />
    <path d="M14 3v6h6M9 13h6M9 17h6" />
  </Sized>
);
export const Sparkles = (p: IconProps) => (
  <Sized {...p}>
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z" />
  </Sized>
);
export const Info = (p: IconProps) => (
  <Sized {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5h.01" />
  </Sized>
);
export const AlertCircle = (p: IconProps) => (
  <Sized {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5M12 16h.01" />
  </Sized>
);
export const Globe = (p: IconProps) => (
  <Sized {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 010 18 14 14 0 010-18z" />
  </Sized>
);
export const Upload = (p: IconProps) => (
  <Sized {...p}>
    <path d="M12 16V4M6 10l6-6 6 6" />
    <path d="M4 18v2a1 1 0 001 1h14a1 1 0 001-1v-2" />
  </Sized>
);
export const Search = (p: IconProps) => (
  <Sized {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M16 16l5 5" />
  </Sized>
);
export const Settings = (p: IconProps) => (
  <Sized {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82h0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </Sized>
);
export const Sun = (p: IconProps) => (
  <Sized {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </Sized>
);
export const Moon = (p: IconProps) => (
  <Sized {...p}>
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </Sized>
);
export const ArrowRight = (p: IconProps) => (
  <Sized {...p}>
    <path d="M5 12h14M13 5l7 7-7 7" />
  </Sized>
);
export const Loader = (p: IconProps) => (
  <Sized {...p}>
    <path d="M21 12a9 9 0 11-6.22-8.56" />
  </Sized>
);
export const Monitor = (p: IconProps) => (
  <Sized {...p}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Sized>
);
export const Asterisk = (p: IconProps) => (
  <Sized {...p}>
    <path d="M12 6v12M7.05 8.05l9.9 7.9M7.05 15.95l9.9-7.9" />
  </Sized>
);
