/**
 * Globalny setup testów Vitest.
 * Importowany w `vitest.config.ts` przez pole `setupFiles`.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
