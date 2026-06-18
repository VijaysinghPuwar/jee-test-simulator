"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Dropzone from "@/components/Dropzone";
import NavBar from "@/components/NavBar";
import {
  extractPdfContent,
  type ExtractedPdfPage,
} from "@/lib/pdf-extract";
import {
  deleteSavedPaper,
  readSavedPapers,
  saveSavedPaper,
  type SavedPaper,
} from "@/lib/saved-papers";
import { useExamStore } from "@/lib/store";
import { JEE_MAIN_CONFIG, type Question, type Subject } from "@/lib/types";

type Stage = "idle" | "extracting" | "parsing" | "ready" | "error";
type UploadMode = "separate" | "combined";

interface ChunkProgress {
  subject: Subject;
  status: "pending" | "ok" | "error";
  count?: number;
  error?: string;
}

const INIT_PROGRESS: ChunkProgress[] = [
  { subject: "Mathematics", status: "pending" },
  { subject: "Physics", status: "pending" },
  { subject: "Chemistry", status: "pending" },
];
const SUBJECTS = INIT_PROGRESS.map((c) => c.subject);

const COMBINED_ANSWER_KEY_NOTE =
  "The answer key and solutions are included in the same uploaded PDF text. Use the answer key, solution explanations, or final-answer sections inside QUESTION_PAPER_TEXT to determine correctAnswer for each question.";

function initialProgress(): ChunkProgress[] {
  return INIT_PROGRESS.map((c) => ({ ...c }));
}

function fileBaseName(name: string): string {
  return name.replace(/\.pdf$/i, "").trim() || name;
}

function formatSavedDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function pageImagePayload(pages: ExtractedPdfPage[]) {
  return pages
    .filter((page): page is ExtractedPdfPage & { imageDataUrl: string } =>
      Boolean(page.imageDataUrl)
    )
    .map((page) => ({
      pageNumber: page.pageNumber,
      text: page.text,
      dataUrl: page.imageDataUrl,
    }));
}

export default function UploadPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const setQuestions = useExamStore((s) => s.setQuestions);
  const addQuestions = useExamStore((s) => s.addQuestions);
  const setParseStatus = useExamStore((s) => s.setParseStatus);
  const startExam = useExamStore((s) => s.startExam);
  const reset = useExamStore((s) => s.reset);
  const userScope = (session?.user?.email ?? "default").toLowerCase();

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [savedPapers, setSavedPapers] = useState<SavedPaper[]>([]);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode>("separate");
  const [combinedFile, setCombinedFile] = useState<File | null>(null);
  const [qpFile, setQpFile] = useState<File | null>(null);
  const [akFile, setAkFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState<string>("");
  const [chunks, setChunks] = useState<ChunkProgress[]>(() => initialProgress());
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/keys")
      .then((r) => (r.ok ? r.json() : { key: null }))
      .then((d) => setHasKey(Boolean(d.key)))
      .catch(() => setHasKey(false));
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") {
      setSavedPapers([]);
      return;
    }
    setSavedPapers(readSavedPapers(userScope));
  }, [status, userScope]);

  const canStart =
    hasKey === true &&
    stage === "idle" &&
    (uploadMode === "combined" ? Boolean(combinedFile) : Boolean(qpFile && akFile));

  function resetParseUi() {
    setStage("idle");
    setProgress("");
    setChunks(initialProgress());
    setTotalLoaded(0);
    setError(null);
    setSavedNotice(null);
    setConfirming(false);
    setParseStatus("idle");
  }

  async function handleStart() {
    if (uploadMode === "combined" && !combinedFile) return;
    if (uploadMode === "separate" && (!qpFile || !akFile)) return;
    reset();
    setError(null);
    setSavedNotice(null);
    setChunks(initialProgress());
    setTotalLoaded(0);
    try {
      setStage("extracting");
      let questionPaperText: string;
      let answerKeyText: string;
      let questionPaperPageImages: ReturnType<typeof pageImagePayload> = [];
      let answerKeyPageImages: ReturnType<typeof pageImagePayload> = [];
      let paperTitle: string;
      let sourceFiles: string[];

      if (uploadMode === "combined") {
        const file = combinedFile as File;
        paperTitle = fileBaseName(file.name);
        sourceFiles = [file.name];
        setProgress(
          "Extracting combined PDF text with selective page image fallback…"
        );
        const questionPaper = await extractPdfContent(file, {
          includePageImages: "auto",
        });
        questionPaperText = questionPaper.text;
        questionPaperPageImages = pageImagePayload(questionPaper.pages);
        answerKeyText = COMBINED_ANSWER_KEY_NOTE;
      } else {
        const questionFile = qpFile as File;
        const keyFile = akFile as File;
        paperTitle = fileBaseName(questionFile.name);
        sourceFiles = [questionFile.name, keyFile.name];
        setProgress(
          "Extracting Question Paper text with selective page image fallback…"
        );
        const questionPaper = await extractPdfContent(questionFile, {
          includePageImages: "auto",
        });
        questionPaperText = questionPaper.text;
        questionPaperPageImages = pageImagePayload(questionPaper.pages);
        setProgress("Extracting Answer Key text with selective page image fallback…");
        const answerKey = await extractPdfContent(keyFile, {
          includePageImages: "auto",
        });
        answerKeyText = answerKey.text;
        answerKeyPageImages = pageImagePayload(answerKey.pages);
      }

      setStage("parsing");
      setParseStatus("streaming");
      let okCount = 0;
      let total = 0;
      let errorCount = 0;
      let lastErr: string | null = null;
      const parsedQuestions: Question[] = [];

      for (const subject of SUBJECTS) {
        setProgress(
          `Parsing ${subject} — questions will appear as each subject completes…`
        );
        try {
          const res = await fetch("/api/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              testType: "JEE_MAIN",
              subjects: [subject],
              questionPaperText,
              answerKeyText,
              questionPaperPageImages,
              answerKeyPageImages,
            }),
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Parse failed: ${res.status}`);
          }
          if (!res.body) throw new Error("No response body from server.");

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.trim()) continue;
              let msg: {
                type: string;
                subject?: Subject;
                questions?: Parameters<typeof addQuestions>[0];
                count?: number;
                error?: string;
              };
              try {
                msg = JSON.parse(line);
              } catch {
                continue;
              }
              if (msg.type === "chunk" && msg.questions && msg.subject) {
                const questions = msg.questions;
                addQuestions(questions);
                parsedQuestions.push(...questions);
                total += questions.length;
                okCount += 1;
                setTotalLoaded(total);
                setChunks((prev) =>
                  prev.map((c) =>
                    c.subject === msg.subject
                      ? { ...c, status: "ok", count: msg.count }
                      : c
                  )
                );
              } else if (msg.type === "error" && msg.subject) {
                errorCount += 1;
                lastErr = msg.error ?? "unknown";
                setChunks((prev) =>
                  prev.map((c) =>
                    c.subject === msg.subject
                      ? { ...c, status: "error", error: msg.error }
                      : c
                  )
                );
              }
            }
          }
        } catch (subjectError) {
          errorCount += 1;
          lastErr =
            subjectError instanceof Error
              ? subjectError.message
              : String(subjectError);
          setChunks((prev) =>
            prev.map((c) =>
              c.subject === subject
                ? { ...c, status: "error", error: lastErr ?? undefined }
                : c
            )
          );
        }
      }

      if (okCount === 0) {
        throw new Error(
          `All subjects failed${lastErr ? `: ${lastErr}` : ""}. Try again with a text-readable PDF, or use OpenAI / ChatGPT API, Anthropic Claude, or Gemini in Settings with a valid provider key.`
        );
      }
      setStage("ready");
      setParseStatus("complete");
      setProgress(
        `Loaded ${total} questions${errorCount > 0 ? ` (${errorCount} subject${errorCount > 1 ? "s" : ""} failed)` : ""}`
      );
      try {
        const saved = saveSavedPaper(userScope, {
          title: paperTitle,
          sourceMode: uploadMode,
          sourceFiles,
          questions: parsedQuestions,
        });
        setSavedPapers(readSavedPapers(userScope));
        setSavedNotice(`Saved "${saved.title}" for later.`);
      } catch (saveError) {
        setSavedNotice(
          `Loaded questions, but could not save locally: ${
            saveError instanceof Error ? saveError.message : String(saveError)
          }`
        );
      }
    } catch (e) {
      setStage("error");
      setParseStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function startSavedPaper(paper: SavedPaper) {
    reset();
    setQuestions(paper.questions);
    setParseStatus("complete");
    startExam();
    router.push("/exam");
  }

  function removeSavedPaper(id: string) {
    setSavedPapers(deleteSavedPaper(userScope, id));
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
            Gemini), and upload either separate question/key PDFs or one
            combined PDF.
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
      <main className="min-h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <header className="mb-8">
            <div className="text-xs font-medium uppercase tracking-wider text-brand-600 dark:text-brand-500">
              CBT Mode
            </div>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900 dark:text-slate-100">
              Upload Papers
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Upload one combined question-and-answer PDF, or separate Question
              Paper and Answer Key PDFs, to begin an NTA-style JEE Main test.
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

          {savedPapers.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Saved Question Papers
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {savedPapers.length} saved
                </span>
              </div>
              <div className="grid gap-3">
                {savedPapers.map((paper) => (
                  <article
                    key={paper.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {paper.title}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span>{paper.questionCount} questions</span>
                          <span>
                            {paper.sourceMode === "combined"
                              ? "Combined PDF"
                              : "Separate PDFs"}
                          </span>
                          <span>Saved {formatSavedDate(paper.updatedAt)}</span>
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
                          {paper.sourceFiles.join(" + ")}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => startSavedPaper(paper)}
                          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                        >
                          Start
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSavedPaper(paper.id)}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-sm dark:border-slate-800 dark:bg-slate-950">
              {(
                [
                  ["separate", "Separate PDFs"],
                  ["combined", "One combined PDF"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setUploadMode(mode);
                    resetParseUi();
                  }}
                  className={`rounded-md px-3 py-1.5 font-medium transition ${
                    uploadMode === mode
                      ? "bg-white text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-300"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {uploadMode === "combined" ? (
              <div className="space-y-3">
                <Dropzone
                  label="Combined Question + Answer PDF"
                  file={combinedFile}
                  onFile={(f) => {
                    setCombinedFile(f);
                    resetParseUi();
                  }}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Use this when the same PDF contains the question paper and the
                  official answer key or solutions.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Dropzone
                  label="Question Paper PDF"
                  file={qpFile}
                  onFile={(f) => {
                    setQpFile(f);
                    resetParseUi();
                  }}
                />
                <Dropzone
                  label="Answer Key / Solutions PDF"
                  file={akFile}
                  onFile={(f) => {
                    setAkFile(f);
                    resetParseUi();
                  }}
                />
              </div>
            )}

            {stage !== "idle" && (
              <div className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                <div className="flex items-center gap-2">
                  {(stage === "extracting" || stage === "parsing") && (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-brand-600" />
                  )}
                  <span>{progress}</span>
                </div>

                {(stage === "parsing" || stage === "ready" || stage === "error") && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Subjects ({totalLoaded} questions loaded)
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {chunks.map((c) => (
                        <div
                          key={c.subject}
                          className={`rounded-md border px-3 py-2 text-xs ${
                            c.status === "ok"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                              : c.status === "error"
                                ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                                : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          <div className="font-medium">{c.subject}</div>
                          <div className="mt-0.5">
                            {c.status === "ok"
                              ? `${c.count ?? "?"} questions`
                              : c.status === "error"
                                ? "Failed"
                                : "Waiting…"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mt-2 text-xs text-red-600">{error}</div>
                )}
                {savedNotice && (
                  <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                    {savedNotice}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  JEE Main
                </span>{" "}
                · {uploadMode === "combined" ? "Combined PDF" : "Separate PDFs"} ·{" "}
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Begin JEE Main Test?
                </h2>
                <ul className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <li>· 3 hours · Auto-submit on timeout</li>
                  <li>· {totalLoaded} questions loaded across subjects</li>
                  <li>· +4 for correct · −1 for wrong (MCQ)</li>
                  <li>· Numerical questions: no negative marking</li>
                </ul>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setConfirming(false)}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
