"use client";

import MathText from "@/components/MathText";
import type { AnswerState, Question } from "@/lib/types";

interface QuestionViewProps {
  question: Question;
  index: number;
  answer: AnswerState | undefined;
  onSelect: (value: string) => void;
}

export default function QuestionView({
  question,
  index,
  answer,
  onSelect,
}: QuestionViewProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-950/70">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Question {index + 1}
          <span className="ml-3 text-xs text-slate-500 dark:text-slate-400">
            ({question.subject} · Section {question.section} ·{" "}
            {question.type === "mcq" ? "Single Correct" : "Numerical"})
          </span>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <span className="rounded bg-green-100 px-1.5 py-0.5 font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
            +4
          </span>
          {question.type === "mcq" && (
            <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              −1
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-800 dark:text-slate-200">
          <MathText text={question.questionText} />
        </div>

        {question.type === "mcq" && question.options && (
          <ul className="mt-6 space-y-3">
            {question.options.map((opt, i) => {
              const value = String(i + 1);
              const selected = answer?.selected === value;
              return (
                <li key={i}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition ${
                      selected
                        ? "border-brand-600 bg-brand-50 dark:bg-brand-600/10"
                        : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${question.id}`}
                      value={value}
                      checked={selected}
                      onChange={() => onSelect(value)}
                      className="mt-0.5 h-4 w-4 accent-brand-600"
                    />
                    <span className="text-sm text-slate-800 dark:text-slate-200">
                      <span className="mr-2 font-mono text-slate-500 dark:text-slate-400">
                        ({value})
                      </span>
                      <MathText text={opt} />
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {question.type === "numerical" && (
          <div className="mt-6 max-w-sm">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Numerical Answer
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={answer?.selected ?? ""}
              onChange={(e) => onSelect(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Enter value"
            />
          </div>
        )}
      </div>
    </div>
  );
}
