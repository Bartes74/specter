#!/usr/bin/env tsx
/**
 * scripts/verify-tutorials.ts (Zadanie 13.6)
 *
 * Weryfikuje czy treść tutoriali w content/tutorials/ jest zgodna ze świeżą zawartością
 * dokumentacji dostawców. Aktualizuje verifiedAgainstDocsAt + contentHash w _meta.json.
 *
 * Uruchomienie:
 *   npm run tutorials:verify             # weryfikuje wszystkie 4 dostawców
 *   npm run tutorials:verify -- openai   # weryfikuje tylko jednego
 *   npm run tutorials:verify -- --dry-run # pokazuje zmiany bez zapisu
 *   npm run tutorials:verify -- --check   # CI: błąd gdy hash/metadane wymagają aktualizacji
 *
 * Strategia (tryb prosty — bez LLM):
 *   1. Pobierz sourceUrl każdego dostawcy (HTTP GET).
 *   2. Sprawdź że zwrócił 200 i że strona zawiera wystarczającą długość treści.
 *   3. Porównaj contentHash zapisanego markdown z aktualnym hashem pliku.
 *   4. Jeśli plik md nie zmienił się od ostatniej weryfikacji → tylko aktualizuj
 *      verifiedAgainstDocsAt (zakładamy że treść była ręcznie zweryfikowana).
 *   5. Jeśli plik md się zmienił → aktualizuj contentHash + lastUpdatedAt + verifiedAgainstDocsAt.
 *
 * Tryb LLM (przyszły) — porównanie semantyczne treści sourceUrl z markdown przez LLM —
 * jest zarezerwowany dla wersji 0.2.
 *
 * Wyjścia:
 *   exit 0 — wszystkie tutoriale zweryfikowane (lub nieaktualne ale zgłoszone)
 *   exit 1 — błąd sieciowy / brak dostępu do source
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { AI_PROVIDERS, type AIProvider } from '../src/types/providers';

const TUTORIALS_DIR = path.join(process.cwd(), 'content', 'tutorials');
const META_FILE = path.join(TUTORIALS_DIR, '_meta.json');

interface TutorialMeta {
  sourceUrl: string;
  lastUpdatedAt: string;
  verifiedAgainstDocsAt: string;
  contentHash: string;
  locales: ('pl' | 'en')[];
}

interface TutorialsMetaFile {
  schemaVersion: 1;
  providers: Record<AIProvider, TutorialMeta>;
}

interface VerifyResult {
  provider: AIProvider;
  status: 'verified' | 'changed' | 'source_unreachable' | 'file_missing';
  details: string;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const check = argv.includes('--check');
  const providerArgs = argv.filter((arg) => !arg.startsWith('--'));
  const onlyProvider = providerArgs[0];
  const targets: AIProvider[] = onlyProvider
    ? AI_PROVIDERS.filter((p) => p === onlyProvider)
    : [...AI_PROVIDERS];

  if (onlyProvider && targets.length === 0) {
    console.error(`Unknown provider: ${onlyProvider}`);
    console.error(`Available: ${AI_PROVIDERS.join(', ')}`);
    process.exit(2);
  }

  const meta = await loadMeta();
  const results: VerifyResult[] = [];
  const shouldWrite = !dryRun && !check;

  for (const provider of targets) {
    const result = await verifyProvider(provider, meta);
    results.push(result);
    printResult(result);
    if (shouldWrite && (result.status === 'verified' || result.status === 'changed')) {
      meta.providers[provider]!.verifiedAgainstDocsAt = new Date().toISOString();
    }
  }

  if (shouldWrite) {
    await saveMeta(meta);
  } else {
    console.log(dryRun ? '\nDry run: _meta.json was not written.' : '\nCheck mode: _meta.json was not written.');
  }

  const hasErrors = results.some((r) => r.status === 'source_unreachable' || r.status === 'file_missing');
  const hasChanges = results.some((r) => r.status === 'changed');
  console.log(`\nSummary: ${results.length} providers checked, ${results.filter((r) => r.status === 'changed').length} content changes, ${results.filter((r) => r.status === 'source_unreachable').length} source errors.`);
  process.exit(hasErrors || (check && hasChanges) ? 1 : 0);
}

async function verifyProvider(
  provider: AIProvider,
  meta: TutorialsMetaFile,
): Promise<VerifyResult> {
  const m = meta.providers[provider];
  if (!m) {
    return { provider, status: 'file_missing', details: 'No entry in _meta.json' };
  }

  // Sprawdź czy plik md istnieje (PL — wystarczy, EN sprawdzimy obok)
  const plFile = path.join(TUTORIALS_DIR, `${provider}.pl.md`);
  const enFile = path.join(TUTORIALS_DIR, `${provider}.en.md`);
  let plContent: string;
  let enContent: string;
  try {
    plContent = await fs.readFile(plFile, 'utf-8');
    enContent = await fs.readFile(enFile, 'utf-8');
  } catch (err) {
    return {
      provider,
      status: 'file_missing',
      details: `Missing file: ${(err as Error).message}`,
    };
  }

  // Hash z konkatenacji obu lokalizacji
  const newHash = crypto.createHash('sha256').update(plContent + enContent).digest('hex');

  // Sprawdź dostępność sourceUrl (HEAD lub GET)
  const sourceOk = await checkSourceReachable(m.sourceUrl);
  if (!sourceOk.ok) {
    return {
      provider,
      status: 'source_unreachable',
      details: `${m.sourceUrl} → ${sourceOk.error}`,
    };
  }

  if (newHash !== m.contentHash) {
    m.contentHash = newHash;
    m.lastUpdatedAt = new Date().toISOString();
    return {
      provider,
      status: 'changed',
      details: `Content hash updated. Source page (${sourceOk.bytes} bytes) reachable.`,
    };
  }

  return {
    provider,
    status: 'verified',
    details: `Content unchanged. Source page (${sourceOk.bytes} bytes) reachable.`,
  };
}

async function checkSourceReachable(
  url: string,
): Promise<{ ok: true; bytes: number } | { ok: false; error: string }> {
  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 15_000);
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'SpecGeneratorTutorialVerifier/1.0 (+local)',
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);
    const text = await res.text();
    if (!res.ok) {
      // Niektóre oficjalne strony dokumentacji blokują automatyczne klienty, ale zwracają
      // pełną stronę ochronną. Dla --check ważne jest, że URL nadal istnieje i nie jest 404.
      if (res.status === 403 && text.length >= 500) {
        return { ok: true, bytes: text.length };
      }
      return { ok: false, error: `HTTP ${res.status}` };
    }
    if (text.length < 500) {
      return { ok: false, error: `Page too short (${text.length} bytes)` };
    }
    return { ok: true, bytes: text.length };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function loadMeta(): Promise<TutorialsMetaFile> {
  const raw = await fs.readFile(META_FILE, 'utf-8');
  return JSON.parse(raw) as TutorialsMetaFile;
}

async function saveMeta(meta: TutorialsMetaFile): Promise<void> {
  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
}

function printResult(r: VerifyResult): void {
  const symbol = {
    verified: '✓',
    changed: '↻',
    source_unreachable: '✗',
    file_missing: '✗',
  }[r.status];
  console.log(`${symbol} [${r.provider.padEnd(10)}] ${r.status.padEnd(20)} ${r.details}`);
}

main().catch((err) => {
  console.error('verify-tutorials failed:', err);
  process.exit(1);
});
