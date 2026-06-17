"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useExamStore } from "@/lib/store";
import Timer from "@/components/Timer";
import QuestionPalette from "@/components/QuestionPalette";
import QuestionView from "@/components/QuestionView";
import type { Subject } from "@/lib/types";

const SUBJECTS: Subject[] = ["Mathematics", "Physics", "Chemistry"];

export default function ExamPage() {
  const router = useRouter();
  const questions = useExamStore((s) => s.questions);
  const answers = useExamStore((s) => s.answers);
  const currentSubject = useExamStore((s) => s.currentSubject);
  const currentQuestionId = useExamStore((s) => s.currentQuestionId);
  const startedAt = useExamStore((s) => s.startedAt);
  const config = useExamStore((s) => s.config);

  const setCurrentSubject = useExamStore((s) => s.setCurrentSubject);
  const setCurrentQuestion = useExamStore((s) => s.setCurrentQuestion);
  const visit = useExamStore((s) => s.visit);
  const selectAnswer = useExamStore((s) => s.selectAnswer);
  const clearAnswer = useExamStore((s) => s.clearAnswer);
  const saveAndNext = useExamStore((s) => s.saveAndNext);
  const markAndNext = useExamStore((s) => s.markAndNext);
  const submitExam = useExamStore((s) => s.submitExam);

  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    if (!startedAt || questions.length === 0) {
      router.replace("/");
    }
  }, [startedAt, questions.length, router]);

  useEffect(() => {
    if (currentQuestionId) visit(currentQuestionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionId]);

  const currentQuestion = useMemo(
    () => questions.find((q) => q.id === currentQuestionId) ?? null,
    [questions, currentQuestionId]
  );

  const indexInSubject = useMemo(() => {
    if (!currentQuestion) return 0;
    const subjectQs = questions.filter(
      (q) => q.subject === currentQuestion.subject
    );
    return subjectQs.findIndex((q) => q.id === currentQuestion.id);
  }, [questions, currentQuestion]);

  const handleSubmit = useCallback(() => {
    submitExam();
    router.push("/results");
  }, [submitExam, router]);

  if (!startedAt || !currentQuestion) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-brand-600">
            JEE Main · Computer-Based Test
          </div>
          <div className="text-sm font-semibold text-slate-800">
            JEE Test Simulator
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Timer
            startedAt={startedAt}
            durationSeconds={config.durationSeconds}
            onTimeout={handleSubmit}
          />
          <button
            onClick={() => setConfirmSubmit(true)}
            className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Submit
          </button>
        </div>
      </header>

      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-6">
        {SUBJECTS.map((s) => {
          const active = s === currentSubject;
          const count = questions.filter((q) => q.subject === s).length;
          return (
            <button
              key={s}
              onClick={() => setCurrentSubject(s)}
              className={`relative px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "text-brand-700"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {s} <span className="ml-1 text-xs text-slate-400">({count})</span>
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-600" />
              )}
            </button>
          );
        })}
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_320px]">
        <section className="flex flex-col overflow-hidden bg-white">
          <QuestionView
            question={currentQuestion}
            index={indexInSubject}
            answer={answers[currentQuestion.id]}
            onSelect={(v) => selectAnswer(currentQuestion.id, v)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => markAndNext(currentQuestion.id)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Mark for Review & Next
              </button>
              <button
                onClick={() => clearAnswer(currentQuestion.id)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Clear Response
              </button>
            </div>
            <button
              onClick={() => saveAndNext(currentQuestion.id)}
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Save & Next
            </button>
          </div>
        </section>

        <QuestionPalette
          questions={questions}
          answers={answers}
          currentSubject={currentSubject}
          currentQuestionId={currentQuestionId}
          onSelect={setCurrentQuestion}
        />
      </div>

      {confirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Submit Exam?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              You will not be able to change your answers after submission.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmSubmit(false)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Continue Test
              </button>
              <button
                onClick={handleSubmit}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Submit Now
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
