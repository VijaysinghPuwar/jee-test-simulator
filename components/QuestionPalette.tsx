"use client";

import type { AnswerState, Question, Subject } from "@/lib/types";

interface PaletteProps {
  questions: Question[];
  answers: Record<string, AnswerState>;
  currentSubject: Subject;
  currentQuestionId: string | null;
  onSelect: (id: string) => void;
}

const STATUS_CLASS: Record<AnswerState["status"], string> = {
  notVisited: "bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600",
  notAnswered: "bg-red-500 text-white border-red-500",
  answered: "bg-green-600 text-white border-green-600",
  markedReview: "bg-violet-600 text-white border-violet-600",
  answeredMarked:
    "bg-violet-600 text-white border-violet-600 ring-2 ring-offset-1 ring-green-500",
};

export default function QuestionPalette({
  questions,
  answers,
  currentSubject,
  currentQuestionId,
  onSelect,
}: PaletteProps) {
  const subjectQs = questions.filter((q) => q.subject === currentSubject);

  const counts = subjectQs.reduce(
    (acc, q) => {
      const s = answers[q.id]?.status ?? "notVisited";
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Record<AnswerState["status"], number>
  );

  return (
    <aside className="flex flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Question Palette
        </div>
        <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
          {currentSubject}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 p-4">
        {subjectQs.map((q, i) => {
          const status = answers[q.id]?.status ?? "notVisited";
          const isCurrent = q.id === currentQuestionId;
          return (
            <button
              key={q.id}
              onClick={() => onSelect(q.id)}
              className={`relative h-9 w-9 rounded-md border text-xs font-semibold transition ${
                STATUS_CLASS[status]
              } ${isCurrent ? "ring-2 ring-brand-600 ring-offset-1" : ""}`}
              title={`Question ${i + 1}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-auto border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
          <LegendRow color="bg-green-600" label="Answered" count={counts.answered ?? 0} />
          <LegendRow color="bg-red-500" label="Not Answered" count={counts.notAnswered ?? 0} />
          <LegendRow color="bg-slate-300" label="Not Visited" count={counts.notVisited ?? 0} />
          <LegendRow color="bg-violet-600" label="Marked for Review" count={counts.markedReview ?? 0} />
          <LegendRow color="bg-violet-600 ring-2 ring-green-500" label="Answered & Marked" count={counts.answeredMarked ?? 0} />
        </div>
      </div>
    </aside>
  );
}

function LegendRow({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-3 w-3 rounded-sm ${color}`} />
      <span className="flex-1">{label}</span>
      <span className="font-mono tabular-nums text-slate-500">{count}</span>
    </div>
  );
}
