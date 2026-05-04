import { describe, expect, it } from 'vitest';
import { stripMarkdownCodeFence } from '@/lib/markdown';

describe('markdown helpers', () => {
  it('usuwa zewnętrzny markdown fence bez ruszania treści', () => {
    const content = stripMarkdownCodeFence('```markdown\n# standards.md\n\nTreść\n```');

    expect(content).toBe('# standards.md\n\nTreść');
  });

  it('zostawia zwykły markdown bez zmian poza trim', () => {
    expect(stripMarkdownCodeFence('\n# standards.md\n')).toBe('# standards.md');
  });
});
