'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createInitialSessionState,
  type SessionState,
} from '@/types/session';
import type { AppLocale } from '@/types/session';

const STORAGE_KEY = 'spec-generator-session';

interface SerializedState {
  /** Cały stan z wyłączeniem `apiKey` (nigdy nie persystowane) */
  state: Omit<SessionState, 'apiKey'>;
  schemaVersion: 1;
}

/**
 * useSessionState — zarządzanie stanem wizarda z persystencją w sessionStorage.
 *
 * Wymagania: 14.1 (klucze API tylko w pamięci sesji), 14.3 (czyszczenie przy zamknięciu).
 *
 * GWARANCJE BEZPIECZEŃSTWA:
 * - `apiKey` NIGDY nie jest serializowany do sessionStorage. Trzymamy go tylko
 *   w stanie React, który znika po przeładowaniu strony.
 *
 * STRATEGIA HYDRACJI:
 * - SSR/initial render: zwracamy initial state (sessionStorage niedostępne).
 * - Po mount: useEffect wczytuje sessionStorage i ustawia state, potem isHydrated=true.
 * - Zapisy są bramkowane przez isHydrated — nie nadpisujemy sessionStorage pustym
 *   stanem podczas pierwszej renderki.
 * - Konsumenci powinni używać `isHydrated` do bramkowania UI (np. nie renderować
 *   wizarda przed hydracją żeby uniknąć migotania krok 1 → krok N).
 */
export function useSessionState(initialLocale: AppLocale = 'pl') {
  const [state, setStateRaw] = useState<SessionState>(() =>
    createInitialSessionState(initialLocale),
  );
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydracja przy mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SerializedState;
        if (parsed?.schemaVersion === 1 && parsed.state) {
          const restored = parsed.state;
          const apiKeyMissingAfterReload = !restored.isDemoMode && restored.apiKeyValid === true;
          setStateRaw((prev) => ({
            ...prev,
            ...restored,
            apiKey: '', // bezpiecznik
            apiKeyValid: restored.isDemoMode ? restored.apiKeyValid : null,
            documentSuggestionIteration: restored.documentSuggestionIteration ?? 0,
            currentStep:
              apiKeyMissingAfterReload && restored.currentStep > 4 ? 4 : restored.currentStep,
          }));
        }
      }
    } catch {
      // niedopasowany schemat — ignorujemy
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Persystencja przy każdej zmianie (debounce 200 ms) — TYLKO po hydracji
  useEffect(() => {
    if (!isHydrated) return;
    const handle = setTimeout(() => {
      try {
        const serialized: SerializedState = { state: toPersistableState(state), schemaVersion: 1 };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
      } catch {
        // quota / private mode — ignorujemy
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [state, isHydrated]);

  // Wyczyść klucz API przy zamknięciu karty (Wymaganie 14.3)
  useEffect(() => {
    if (!isHydrated) return;
    const onBeforeUnload = () => {
      try {
        const serialized: SerializedState = { state: toPersistableState(state), schemaVersion: 1 };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
      } catch {
        // ignore
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state, isHydrated]);

  // Update — partial merge ALBO funkcja
  const update = useCallback(
    (patch: Partial<SessionState> | ((prev: SessionState) => Partial<SessionState>)) => {
      setStateRaw((prev) => {
        const partial = typeof patch === 'function' ? patch(prev) : patch;
        const keys = Object.keys(partial) as Array<keyof SessionState>;
        if (keys.length === 0) return prev;
        const changed = keys.some((key) => !Object.is(prev[key], partial[key]));
        if (!changed) return prev;
        return { ...prev, ...partial };
      });
    },
    [],
  );

  // Reset całego stanu (np. po ukończeniu generowania)
  const reset = useCallback(() => {
    setStateRaw(createInitialSessionState(initialLocale));
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [initialLocale]);

  return { state, update, reset, isHydrated };
}

function toPersistableState(state: SessionState): Omit<SessionState, 'apiKey'> {
  const { apiKey: _apiKey, ...persistable } = state;
  return state.isDemoMode ? persistable : { ...persistable, apiKeyValid: null };
}
