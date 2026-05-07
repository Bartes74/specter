/**
 * Integracja: GET /api/standards/profiles
 * Validates: pytania kroku 6 zbierają preferencje wykonawcze do standards.md.
 */
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/standards/profiles/route';

describe('GET /api/standards/profiles', () => {
  it('zwraca spójny zestaw pytań technicznych dla każdego profilu', async () => {
    const res = await GET(new Request('http://localhost/api/standards/profiles?locale=pl'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      profiles: Array<{
        id: string;
        followUpQuestions: Array<{ id: string; text: string; hint?: string }>;
      }>;
    };

    expect(body.profiles.length).toBeGreaterThan(0);
    for (const profile of body.profiles) {
      expect(profile.followUpQuestions).toHaveLength(7);
      expect(profile.followUpQuestions.every((question) => question.hint?.trim())).toBe(true);

      const combinedText = profile.followUpQuestions
        .map((question) => `${question.id} ${question.text}`)
        .join(' ')
        .toLowerCase();
      expect(combinedText).not.toMatch(/auth|compliance|logowanie|zgodność|rodo|gdpr|hipaa/);
    }
  });

  it('profil React/Next.js pyta o stack, architekturę, biblioteki, jakość, testy, UX i utrzymanie', async () => {
    const res = await GET(new Request('http://localhost/api/standards/profiles?locale=pl'));
    const body = (await res.json()) as {
      profiles: Array<{ id: string; followUpQuestions: Array<{ id: string }> }>;
    };

    const webapp = body.profiles.find((profile) => profile.id === 'webapp-react');
    expect(webapp?.followUpQuestions.map((question) => question.id)).toEqual([
      'stack-tooling',
      'architecture-defaults',
      'library-patterns',
      'code-quality',
      'testing-policy',
      'ux-accessibility',
      'operations-maintenance',
    ]);
  });
});
