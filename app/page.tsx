"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Dropzone from "@/components/Dropzone";
import NavBar from "@/components/NavBar";
import { extractPdfText } from "@/lib/pdf-extract";
import { useExamStore } from "@/lib/store";
import { JEE_MAIN_CONFIG } from "@/lib/types";

type Stage = "idle" | "extracting" | "parsing" | "ready" | "error";

export default function UploadPage() {
  const router = useRouter();
  const { status } = useSession();
  const setQuestions = useExamStore((s) => s.setQuestions);
  const startExam = useExamStore((s) => s.startExam);

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [qpFile, setQpFile] = useState<File | null>(null);
  const [akFile, setAkFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/keys")
      .then((r) => (r.ok ? r.json() : { key: null }))
      .then((d) => setHasKey(Boolean(d.key)))
      .catch(() => setHasKey(false));
  }, [status]);

  const canStart = qpFile && akFile && stage === "idle" && hasKey;

  async function handleStart() {
    if (!qpFile || !akFile) return;
    setError(null);
    try {
      setStage("extracting");
      setProgress("Extracting Question Paper text…");
      const questionPaperText = await extractPdfText(qpFile);
      setProgress("Extracting Answer Key text…");
      const answerKeyText = await extractPdfText(akFile);
      setStage("parsing");
      setProgress("Parsing with your selected provider…");
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testType: "JEE_MAIN",
          questionPaperText,
          answerKeyText,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          res.status === 504
            ? "Provider took too long to respond (timeout). Try a faster model (e.g. Gemini 2.0 Flash) or smaller PDFs."
            : body.error || `Parse failed: ${res.status}`;
        throw new Error(msg);
      }
      const data = (await res.json()) as {
        questions: unknown[];
        partial?: { subject: string; error: string }[];
      };
      const questions = data.questions as Parameters<typeof setQuestions>[0];
      if (!questions || questions.length === 0) {
        throw new Error("No questions extracted from the PDFs.");
      }
      setQuestions(questions);
      setStage("ready");
      const partial = data.partial?.length
        ? ` (${data.partial.map((p) => p.subject).join(", ")} failed — partial result)`
        : "";
      setProgress(`Extracted ${questions.length} questions${partial}`);
    } catch (e) {
      setStage("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleConfirm() {
    startExam();
    router.push("/exam");
  }

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </main>
    );
  }
  if (status === "unauthenticated") {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-2xl px-6 py-16">
          <div className="text-xs font-medium uppercase tracking-wider text-brand-600">
            JEE Test Simulator
          </div>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            Practice JEE Main in a real NTA-style portal
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Sign in with Google, add your own API key (Anthropic / OpenAI /
            Gemini), and upload your question paper + answer key PDFs.
          </p>
          <button
            onClick={() => router.push("/signin")}
            className="mt-6 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Sign in to get started
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="min-h-[calc(100vh-3.5rem)] bg-slate-50">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <header className="mb-8">
            <div className="text-xs font-medium uppercase tracking-wider text-brand-600">
              CBT Mode
            </div>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">
              Upload Papers
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Upload your Question Paper and Answer Key PDFs to begin an
              NTA-style JEE Main test.
            </p>
          </header>

          {hasKey === false && (
            <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <div>
                <div className="font-medium text-amber-900">
                  No provider API key configured
                </div>
                <div className="text-xs text-amber-800">
                  Add an API key in Settings before starting a test.
                </div>
              </div>
              <button
                onClick={() => router.push("/settings")}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
              >
                Go to Settings
              </button>
            </div>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Dropzone
                label="Question Paper PDF"
                file={qpFile}
                onFile={(f) => {
                  setQpFile(f);
                  setStage("idle");
                  setError(null);
                }}
              />
              <Dropzone
                label="Answer Key / Solutions PDF"
                file={akFile}
                onFile={(f) => {
                  setAkFile(f);
                  setStage("idle");
                  setError(null);
                }}
              />
            </div>

            {stage !== "idle" && (
              <div className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  {(stage === "extracting" || stage === "parsing") && (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-brand-600" />
                  )}
                  <span>{progress}</span>
                </div>
                {error && (
                  <div className="mt-2 text-xs text-red-600">{error}</div>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
              <div className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">JEE Main</span> ·{" "}
                {JEE_MAIN_CONFIG.totalQuestions} questions ·{" "}
                {JEE_MAIN_CONFIG.durationSeconds / 3600} hrs · +
                {JEE_MAIN_CONFIG.positiveMark} / −{JEE_MAIN_CONFIG.negativeMark}
              </div>
              {stage === "ready" ? (
                <button
                  onClick={() => setConfirming(true)}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
                >
                  Start Test
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={!canStart}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {stage === "extracting" || stage === "parsing"
                    ? "Processing…"
                    : "Parse PDFs"}
                </button>
              )}
            </div>
          </section>

          {confirming && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-slate-900">
                  Begin JEE Main Test?
                </h2>
                <ul className="mt-4 space-y-1 text-sm text-slate-600">
                  <li>· 3 hours · Auto-submit on timeout</li>
                  <li>· 75 questions across Mathematics, Physics, Chemistry</li>
                  <li>· +4 for correct · −1 for wrong (MCQ)</li>
                  <li>· Numerical questions: no negative marking</li>
                </ul>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setConfirming(false)}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    Start Now
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
