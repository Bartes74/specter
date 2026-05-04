/**
 * Definicja kroków wizarda — pojedyncze źródło prawdy.
 */
import type { useTranslations } from 'next-intl';

export type StepId =
  | 'project'
  | 'description'
  | 'questions'
  | 'tool'
  | 'model'
  | 'standards'
  | 'generate'
  | 'preview';

export interface StepDefinition {
  id: StepId;
  /** Klucz tłumaczeń dla tytułu (sekcja: wizard.titles.<id>) */
  titleKey: string;
  /** Klucz tłumaczeń dla opisu (sekcja: wizard.descriptions.<id>) */
  descriptionKey: string;
}

export const STEPS: ReadonlyArray<StepDefinition> = [
  { id: 'project',     titleKey: 'projectPicker.title',  descriptionKey: 'projectPicker.subtitle' },
  { id: 'description', titleKey: 'description.title',    descriptionKey: 'description.subtitle' },
  { id: 'questions',   titleKey: 'questions.title',      descriptionKey: 'questions.subtitle' },
  { id: 'tool',        titleKey: 'tool.title',           descriptionKey: 'tool.subtitle' },
  { id: 'model',       titleKey: 'model.title',          descriptionKey: 'model.subtitle' },
  { id: 'standards',   titleKey: 'standards.title',      descriptionKey: 'standards.existing' },
  { id: 'generate',    titleKey: 'generation.title',     descriptionKey: 'generation.subtitle' },
  { id: 'preview',     titleKey: 'preview.title',        descriptionKey: 'preview.subtitle' },
] as const;

export function buildStepsForLayout(
  t: ReturnType<typeof useTranslations>,
  currentStepIndex: number,
  completedFlags: Partial<Record<StepId, boolean>>,
) {
  return STEPS.map((step, idx) => ({
    id: step.id,
    title: t(step.titleKey),
    description: t(step.descriptionKey),
    completed: completedFlags[step.id] ?? idx < currentStepIndex,
    active: idx === currentStepIndex,
  }));
}
