"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useExamStore } from "@/lib/store";
import { gradeExam } from "@/lib/grading";
import {
  ResponseDonut,
  SubjectScoreBar,
} from "@/components/ResultsCharts";
import NavBar from "@/components/NavBar";

export default function ResultsPage() {
  const router = useRouter();
  const questions = useExamStore((s) => s.questions);
  const answers = useExamStore((s) => s.answers);
  const config = useExamStore((s) => s.config);
  const submittedAt = useExamStore((s) => s.submittedAt);
  const reset = useExamStore((s) => s.reset);

  useEffect(() => {
    if (!submittedAt || questions.length === 0) {
      router.replace("/");
    }
  }, [submittedAt, questions.length, router]);

  const result = useMemo(
    () => gradeExam(questions, answers, config),
    [questions, answers, config]
  );

  if (!submittedAt || questions.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </main>
    );
  }

  return (
    <>
      <NavBar />
      <main className="min-h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-brand-600 dark:text-brand-500">
              Test Result
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              JEE Main · Performance Summary
            </h1>
          </div>
          <button
            onClick={() => {
              reset();
              router.push("/");
            }}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Take Another Test
          </button>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <ScoreCard
            label="Total Score"
            value={`${result.totalScore} / ${result.maxScore}`}
            sub={`${((result.totalScore / Math.max(1, result.maxScore)) * 100).toFixed(1)}%`}
            accent="brand"
          />
          {result.subjects.map((s) => (
            <ScoreCard
              key={s.subject}
              label={s.subject}
              value={`${s.score} / ${s.total * config.positiveMark}`}
              sub={`${s.accuracy.toFixed(1)}% accuracy`}
            />
          ))}
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Score by Subject">
            <SubjectScoreBar result={result} />
          </ChartCard>
          <ChartCard title="Response Breakdown">
            <ResponseDonut result={result} />
          </ChartCard>
        </section>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Subject-wise</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">Subject</th>
                  <th className="py-2 pr-4 font-medium">Attempted</th>
                  <th className="py-2 pr-4 font-medium">Correct</th>
                  <th className="py-2 pr-4 font-medium">Wrong</th>
                  <th className="py-2 pr-4 font-medium">Unattempted</th>
                  <th className="py-2 pr-4 font-medium">Score</th>
                  <th className="py-2 font-medium">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {result.subjects.map((s) => (
                  <tr
                    key={s.subject}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-2.5 pr-4 font-medium text-slate-800">
                      {s.subject}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-700">
                      {s.attempted} / {s.total}
                    </td>
                    <td className="py-2.5 pr-4 text-green-700">{s.correct}</td>
                    <td className="py-2.5 pr-4 text-red-700">{s.wrong}</td>
                    <td className="py-2.5 pr-4 text-slate-500">
                      {s.unattempted}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-slate-800">
                      {s.score}
                    </td>
                    <td className="py-2.5 text-slate-700">
                      {s.accuracy.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Question-by-Question Review
          </h2>
          <div className="mt-4 space-y-3">
            {result.perQuestion.map((r, i) => {
              const attempted =
                r.userAnswer !== null && r.userAnswer !== "";
              const status = !attempted
                ? "skipped"
                : r.isCorrect
                  ? "correct"
                  : "wrong";
              return (
                <div
                  key={r.question.id}
                  className="rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-slate-500">
                      Q{i + 1} · {r.question.subject} · Section{" "}
                      {r.question.section}
                    </div>
                    <StatusPill status={status} marks={r.marks} />
                  </div>
                  <div className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm text-slate-800">
                    {r.question.questionText}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    <div>
                      <span className="text-slate-500">Your answer: </span>
                      <span className="font-mono text-slate-800">
                        {attempted ? r.userAnswer : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Correct: </span>
                      <span className="font-mono text-green-700">
                        {r.question.correctAnswer || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
    </>
  );
}

function ScoreCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: "brand";
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        accent === "brand"
          ? "border-brand-200 bg-brand-50 dark:border-brand-800/60 dark:bg-brand-600/10"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</div>
      {children}
    </div>
  );
}

function StatusPill({
  status,
  marks,
}: {
  status: "correct" | "wrong" | "skipped";
  marks: number;
}) {
  const cls =
    status === "correct"
      ? "bg-green-100 text-green-700"
      : status === "wrong"
        ? "bg-red-100 text-red-700"
        : "bg-slate-100 text-slate-600";
  const label =
    status === "correct" ? "Correct" : status === "wrong" ? "Wrong" : "Skipped";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
      <span className="font-mono">
        {marks > 0 ? `+${marks}` : marks === 0 ? "0" : marks}
      </span>
    </span>
  );
}
