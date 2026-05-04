/**
 * POST /api/models/catalog — odświeża katalog modeli z oficjalnych endpointów dostawców.
 *
 * Bez klucza zwraca statyczny seed. Z kluczem pobiera realnie dostępne modele
 * dla konta użytkownika i scala je z opisami/kosztami znanych rodzin.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody } from '@/lib/api-helpers';
import { AI_PROVIDERS } from '@/types/providers';
import { loadModelCatalog } from '@/services/ModelCatalogService';

export const dynamic = 'force-dynamic';

const schema = z.object({
  aiProvider: z.enum(AI_PROVIDERS).optional(),
  apiKey: z.string().optional(),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  const catalog = await loadModelCatalog({
    provider: parsed.data.aiProvider,
    apiKey: parsed.data.apiKey,
    force: parsed.data.force,
  });

  return NextResponse.json(catalog);
}
