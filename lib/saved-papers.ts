import { JEE_MAIN_CONFIG, type Question } from "@/lib/types";

export type SavedPaperSourceMode = "separate" | "combined";

export interface SavedPaper {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sourceMode: SavedPaperSourceMode;
  sourceFiles: string[];
  questionCount: number;
  questions: Question[];
}

interface SavePaperInput {
  title: string;
  sourceMode: SavedPaperSourceMode;
  sourceFiles: string[];
  questions: Question[];
}

const STORAGE_PREFIX = "jee-test-simulator:saved-papers:v1";

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}:${scope}`;
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== "object") return false;
  const q = value as Partial<Question>;
  return (
    typeof q.id === "string" &&
    (q.subject === "Mathematics" ||
      q.subject === "Physics" ||
      q.subject === "Chemistry") &&
    (q.section === "I" || q.section === "II") &&
    (q.type === "mcq" || q.type === "numerical") &&
    typeof q.questionText === "string" &&
    typeof q.correctAnswer === "string"
  );
}

function isSavedPaper(value: unknown): value is SavedPaper {
  if (!value || typeof value !== "object") return false;
  const paper = value as Partial<SavedPaper>;
  return (
    typeof paper.id === "string" &&
    typeof paper.title === "string" &&
    typeof paper.createdAt === "string" &&
    typeof paper.updatedAt === "string" &&
    (paper.sourceMode === "separate" || paper.sourceMode === "combined") &&
    Array.isArray(paper.sourceFiles) &&
    paper.sourceFiles.every((name) => typeof name === "string") &&
    Array.isArray(paper.questions) &&
    paper.questions.length === JEE_MAIN_CONFIG.totalQuestions &&
    paper.questions.every(isQuestion)
  );
}

export function readSavedPapers(scope: string): SavedPaper[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(storageKey(scope));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isSavedPaper)
      .map((paper) => ({
        ...paper,
        questionCount: paper.questions.length,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function writeSavedPapers(scope: string, papers: SavedPaper[]) {
  window.localStorage.setItem(storageKey(scope), JSON.stringify(papers));
}

export function saveSavedPaper(
  scope: string,
  input: SavePaperInput
): SavedPaper {
  if (input.questions.length !== JEE_MAIN_CONFIG.totalQuestions) {
    throw new Error(
      `Cannot save an incomplete paper (${input.questions.length}/${JEE_MAIN_CONFIG.totalQuestions} questions).`
    );
  }

  const now = new Date().toISOString();
  const papers = readSavedPapers(scope);
  const sourceKey = `${input.sourceMode}:${input.sourceFiles.join("|")}`;
  const existing = papers.find(
    (paper) => `${paper.sourceMode}:${paper.sourceFiles.join("|")}` === sourceKey
  );
  const saved: SavedPaper = {
    id: existing?.id ?? createId(),
    title: input.title.trim() || "Untitled JEE Paper",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    sourceMode: input.sourceMode,
    sourceFiles: input.sourceFiles,
    questionCount: input.questions.length,
    questions: input.questions,
  };

  writeSavedPapers(scope, [
    saved,
    ...papers.filter((paper) => paper.id !== saved.id),
  ]);
  return saved;
}

export function deleteSavedPaper(scope: string, id: string): SavedPaper[] {
  const next = readSavedPapers(scope).filter((paper) => paper.id !== id);
  writeSavedPapers(scope, next);
  return next;
}
