'use client';

import React from 'react';
import { ErrorProfile } from './ErrorProfile';
import type { ErrorProfileData, FixAction } from '@/lib/errors';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onAction?: (action: FixAction) => void },
  { profile: ErrorProfileData | null }
> {
  override state: { profile: ErrorProfileData | null } = { profile: null };

  static getDerivedStateFromError(error: Error) {
    return {
      profile: {
        errorId: crypto.randomUUID(),
        code: 'UNKNOWN',
        whatHappened: 'Interfejs napotkał nieoczekiwany błąd.',
        whatItMeans: 'Stan sesji powinien nadal być zapisany w przeglądarce.',
        howToFix: ['Odśwież widok lub spróbuj wrócić do poprzedniego kroku.'],
        fixActions: [{ label: 'Skopiuj raport błędu', kind: 'copy-report', primary: true }],
        fixPrompt: error.message,
        retryable: false,
      } satisfies ErrorProfileData,
    };
  }

  override render() {
    if (this.state.profile) {
      return (
        <div className="p-8">
          <ErrorProfile
            data={this.state.profile}
            onAction={(action) => this.props.onAction?.(action)}
            onDismiss={() => this.setState({ profile: null })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
