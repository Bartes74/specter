'use client';

import { useCallback, useState } from 'react';
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
  | { type: 'content'; document: GeneratedDocumentType; chunk: string }
  | { type: 'document_complete'; document: GeneratedDocumentType; fullContent: string }
  | { type: 'error'; code: string; message: string; retryable: boolean }
  | { type: 'done'; documents?: Record<string, string> };

export function useGeneration() {
  const [documents, setDocuments] = useState<GenerationDocuments>({});
  const [progress, setProgress] = useState<GenerationProgressState>({
    activeStep: null,
    message: '',
    status: 'idle',
  });

  const consumeStream = useCallback(
    async (
      url: string,
      body: unknown,
      demo: boolean,
      onDocumentComplete?: (document: GeneratedDocumentType, content: string) => void,
    ) => {
      setProgress({ activeStep: null, message: '', status: 'generating' });
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(demo ? { 'x-demo-mode': 'true' } : {}),
        },
        body: JSON.stringify(body),
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
          } else if (event.type === 'content') {
            setDocuments((prev) => ({
              ...prev,
              [event.document]: `${prev[event.document] ?? ''}${event.chunk}`,
            }));
          } else if (event.type === 'document_complete') {
            setDocuments((prev) => ({ ...prev, [event.document]: event.fullContent }));
            onDocumentComplete?.(event.document, event.fullContent);
          } else if (event.type === 'error') {
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
    },
    [],
  );

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

  return { documents, setDocuments, progress, generateSpec, generateStandards, regenerateDocument };
}
