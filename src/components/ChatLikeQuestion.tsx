'use client';

import { Button } from './ui/Button';
import { Textarea } from './ui/Input';
import { Badge } from './ui/Badge';
import { ChevronLeft, ChevronRight, Sparkles } from './ui/Icon';
import type { Question } from '@/types/session';

export function ChatLikeQuestion({
  question,
  questionIndex,
  totalQuestions,
  completenessPercent,
  currentAnswer,
  onAnswerChange,
  onNext,
  onPrevious,
  onSkip,
  onSkipAllRemaining,
  onRequestMore,
  canGoPrevious,
}: {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  completenessPercent: number;
  currentAnswer: string;
  onAnswerChange: (answer: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onSkipAllRemaining: () => void;
  onRequestMore: () => void;
  canGoPrevious: boolean;
}) {
  const ready = completenessPercent >= 80;
  return (
    <div className="max-w-3xl animate-slide-in-r">
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Badge tone="editorial">Pytanie {questionIndex} z {totalQuestions}</Badge>
        <Badge tone={ready ? 'success' : 'accent'}>
          {completenessPercent}% informacji
        </Badge>
        {ready && <Badge tone="success">Możesz zakończyć etap pytań</Badge>}
      </div>

      <div className="border-t border-rule pt-7">
        <h2 className="font-display text-4xl text-ink leading-tight">{question.text}</h2>
        {question.hint && <p className="mt-3 text-sm text-ink-muted">{question.hint}</p>}
      </div>

      {question.suggestedAnswers && question.suggestedAnswers.length > 0 && (
        <div className="mt-7">
          <p className="eyebrow mb-3">Sugerowane odpowiedzi</p>
          <div className="flex flex-wrap gap-2">
            {question.suggestedAnswers.map((answer) => (
              <button
                key={answer.id}
                type="button"
                onClick={() => onAnswerChange(answer.value)}
                className="rounded border border-rule bg-bg-elevated px-3 py-2 text-sm text-ink-muted hover:border-sienna hover:text-ink transition-colors"
              >
                {answer.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-7">
        <Textarea
          value={currentAnswer}
          onChange={(event) => onAnswerChange(event.target.value)}
          placeholder="Twoja odpowiedź..."
          className="min-h-[180px]"
        />
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            iconLeft={<ChevronLeft size={14} />}
            onClick={onPrevious}
            disabled={!canGoPrevious}
          >
            Wstecz
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            Pomiń
          </Button>
          <Button variant="ghost" onClick={onSkipAllRemaining}>
            Pomiń pozostałe
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" iconLeft={<Sparkles size={14} />} onClick={onRequestMore}>
            Więcej pytań
          </Button>
          <Button variant="primary" iconRight={<ChevronRight size={14} />} onClick={onNext}>
            Dalej
          </Button>
        </div>
      </div>
    </div>
  );
}
