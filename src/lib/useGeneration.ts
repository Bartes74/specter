'use client';

import { useCallback, useRef, useState } from 'react';
import type { AppLocale, QuestionAnswer } from '@/types/session';
import type { AIProvider, TargetTool } from '@/types/providers';

export type GeneratedDocumentType = 'requirements' | 'design' | 'tasks' | 'standards';

export interface GenerationDocuments {
  requirements?: string;
  design?: string;
  tasks?: string;
  standards?: string;
}

export interface GenerationProgressState {
  activeStep: GeneratedDocumentType | null;
  message: string;
  status: 'idle' | 'generating' | 'completed' | 'error';
  error?: { code: string; message: string; retryable: boolean };
  section?: {
    document: Exclude<GeneratedDocumentType, 'standards'>;
    sectionId: string;
    sectionTitle: string;
    index: number;
    total: number;
    status: 'planning' | 'generating' | 'continuing' | 'repairing' | 'complete';
  };
}

interface GenerateSpecInput {
  projectPath: string;
  projectDescription: string;
  answers: QuestionAnswer[];
  targetTool: TargetTool;
  aiProvider: AIProvider;
  aiModel: string;
  apiKey: string;
  standards?: string | null;
  locale: AppLocale;
  demo?: boolean;
}

interface GenerateStandardsInput {
  profileId: string;
  profileName: string;
  followUpAnswers: QuestionAnswer[];
  aiProvider: AIProvider;
  aiModel: string;
  apiKey?: string;
  locale: AppLocale;
  demo?: boolean;
}

interface RegenerateDocumentInput extends Omit<GenerateSpecInput, 'projectPath' | 'demo'> {
  documentType: 'requirements' | 'design' | 'tasks';
  mode: 'all' | 'section';
  sectionAnchor?: string;
  additionalInstructions?: string;
  previousDocuments?: { requirements?: string; design?: string };
  demo?: boolean;
}

type StreamEvent =
  | { type: 'progress'; step: string; message: string }
  | {
      type: 'section_progress';
      document: Exclude<GeneratedDocumentType, 'standards'>;
      sectionId: string;
      sectionTitle: string;
      index: number;
      total: number;
      status: 'planning' | 'generating' | 'continuing' | 'repairing' | 'complete';
    }
  | { type: 'content'; document: GeneratedDocumentType; chunk: string }
  | { type: 'document_complete'; document: GeneratedDocumentType; fullContent: string }
  | { type: 'error'; code: string; message: string; retryable: boolean }
  | { type: 'done'; documents?: Record<string, string> };

export class GenerationCancelledError extends Error {
  constructor() {
    super('Generowanie przerwane przez użytkownika.');
    this.name = 'GenerationCancelledError';
  }
}

export function useGeneration() {
  const [documents, setDocuments] = useState<GenerationDocuments>({});
  const [progress, setProgress] = useState<GenerationProgressState>({
    activeStep: null,
    message: '',
    status: 'idle',
  });
  const abortRef = useRef<AbortController | null>(null);

  const consumeStream = useCallback(
    async (
      url: string,
      body: unknown,
      demo: boolean,
      onDocumentComplete?: (document: GeneratedDocumentType, content: string) => void,
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setProgress({ activeStep: null, message: '', status: 'generating' });
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(demo ? { 'x-demo-mode': 'true' } : {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const payload = await res.json().catch(() => null);
          const message = payload?.error?.message ?? `HTTP ${res.status}`;
          setProgress({
            activeStep: null,
            message,
            status: 'error',
            error: { code: payload?.error?.code ?? 'UNKNOWN', message, retryable: false },
          });
          throw new Error(message);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            const dataLine = part
              .split('\n')
              .find((line) => line.startsWith('data: '));
            if (!dataLine) continue;
            const event = JSON.parse(dataLine.slice(6)) as StreamEvent;
            if (event.type === 'progress') {
              setProgress({
                activeStep: event.step as GeneratedDocumentType,
                message: event.message,
                status: 'generating',
              });
            } else if (event.type === 'section_progress') {
              const prefix = event.total > 0 ? `Sekcja ${event.index}/${event.total}` : 'Planowanie sekcji';
              const statusLabel = sectionStatusLabel(event.status);
              setProgress({
                activeStep: event.document,
                message: `${prefix}: ${event.sectionTitle} — ${statusLabel}`,
                status: 'generating',
                section: event,
              });
            } else if (event.type === 'content') {
              setDocuments((prev) => ({
                ...prev,
                [event.document]: `${prev[event.document] ?? ''}${event.chunk}`,
              }));
            } else if (event.type === 'document_complete') {
              setDocuments((prev) => ({ ...prev, [event.document]: event.fullContent }));
              onDocumentComplete?.(event.document, event.fullContent);
            } else if (event.type === 'error') {
              setDocuments({});
              setProgress({
                activeStep: null,
                message: event.message,
                status: 'error',
                error: event,
              });
              throw new Error(event.message);
            } else if (event.type === 'done') {
              setProgress({ activeStep: null, message: '', status: 'completed' });
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) {
          setProgress({
            activeStep: null,
            message: 'Generowanie przerwane',
            status: 'idle',
          });
          throw new GenerationCancelledError();
        }
        throw err;
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [],
  );

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
    setProgress((prev) =>
      prev.status === 'generating'
        ? { activeStep: null, message: 'Generowanie przerwane', status: 'idle' }
        : prev,
    );
  }, []);

  const generateSpec = useCallback(
    async (input: GenerateSpecInput, onComplete?: (docs: GenerationDocuments) => void) => {
      setDocuments({});
      const nextDocs: GenerationDocuments = {};
      await consumeStream('/api/generate', input, input.demo === true, (doc, content) => {
        nextDocs[doc] = content;
      });
      onComplete?.(nextDocs);
      return nextDocs;
    },
    [consumeStream],
  );

  const generateStandards = useCallback(
    async (input: GenerateStandardsInput, onComplete?: (content: string) => void) => {
      setDocuments({});
      let standards = '';
      await consumeStream('/api/standards/generate', input, input.demo === true, (doc, content) => {
        if (doc === 'standards') standards = content;
      });
      onComplete?.(standards);
      return standards;
    },
    [consumeStream],
  );

  const regenerateDocument = useCallback(
    async (input: RegenerateDocumentInput, onComplete?: (content: string) => void) => {
      setDocuments({});
      let content = '';
      await consumeStream('/api/generate/document', input, input.demo === true, (doc, full) => {
        if (doc === input.documentType) content = full;
      });
      onComplete?.(content);
      return content;
    },
    [consumeStream],
  );

  return { documents, setDocuments, progress, generateSpec, generateStandards, regenerateDocument, cancelGeneration };
}

function sectionStatusLabel(status: NonNullable<GenerationProgressState['section']>['status']): string {
  switch (status) {
    case 'planning':
      return 'układam manifest';
    case 'generating':
      return 'generuję';
    case 'continuing':
      return 'kontynuuję po limicie tokenów';
    case 'repairing':
      return 'domykam i waliduję';
    case 'complete':
      return 'gotowe';
  }
}
