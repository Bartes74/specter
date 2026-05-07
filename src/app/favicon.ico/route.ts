const favicon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#f2a65f"/>
  <path d="M32 14l3.5 12.5L48 30l-12.5 3.5L32 46l-3.5-12.5L16 30l12.5-3.5L32 14z" fill="#14100d"/>
</svg>
`.trim();

export const dynamic = 'force-static';

export function GET() {
  return new Response(favicon, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
