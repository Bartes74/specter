/**
 * GET /api/health — health check używany przez start.sh / start.bat (Wymaganie 18.4).
 */
import { NextResponse } from 'next/server';
import packageJson from '../../../../package.json';

export const dynamic = 'force-dynamic';

const startedAt = Date.now();

export async function GET() {
  return NextResponse.json({
    ok: true,
    pid: process.pid,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    version: packageJson.version,
  });
}
