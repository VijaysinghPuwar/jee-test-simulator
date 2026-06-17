"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AnswerState,
  ExamConfig,
  Question,
  Subject,
} from "./types";
import { JEE_MAIN_CONFIG } from "./types";

type ParseStatus = "idle" | "streaming" | "complete" | "error";

interface ExamStore {
  questions: Question[];
  answers: Record<string, AnswerState>;
  currentSubject: Subject;
  currentQuestionId: string | null;
  config: ExamConfig;
  startedAt: number | null;
  submittedAt: number | null;
  parseStatus: ParseStatus;

  setQuestions: (qs: Question[]) => void;
  addQuestions: (qs: Question[]) => void;
  setParseStatus: (s: ParseStatus) => void;
  startExam: () => void;
  setCurrentSubject: (s: Subject) => void;
  setCurrentQuestion: (id: string) => void;
  selectAnswer: (id: string, value: string) => void;
  clearAnswer: (id: string) => void;
  saveAndNext: (id: string) => void;
  markAndNext: (id: string) => void;
  visit: (id: string) => void;
  submitExam: () => void;
  reset: () => void;
}

const SUBJECT_ORDER: Record<Subject, number> = {
  Mathematics: 0,
  Physics: 1,
  Chemistry: 2,
};

function idNumeric(id: string): number {
  const m = id.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function sortQuestions(qs: Question[]): Question[] {
  return [...qs].sort((a, b) => {
    const s = SUBJECT_ORDER[a.subject] - SUBJECT_ORDER[b.subject];
    if (s !== 0) return s;
    const sec = (a.section === "I" ? 0 : 1) - (b.section === "I" ? 0 : 1);
    if (sec !== 0) return sec;
    return idNumeric(a.id) - idNumeric(b.id);
  });
}

function nextQuestionId(
  questions: Question[],
  currentId: string | null
): string | null {
  if (questions.length === 0) return null;
  if (!currentId) return questions[0].id;
  const idx = questions.findIndex((q) => q.id === currentId);
  if (idx === -1 || idx === questions.length - 1) return currentId;
  return questions[idx + 1].id;
}

export const useExamStore = create<ExamStore>()(
  persist(
    (set, get) => ({
      questions: [],
      answers: {},
      currentSubject: "Mathematics",
      currentQuestionId: null,
      config: JEE_MAIN_CONFIG,
      startedAt: null,
      submittedAt: null,
      parseStatus: "idle",

      setQuestions: (qs) => {
        const sorted = sortQuestions(qs);
        const answers: Record<string, AnswerState> = {};
        sorted.forEach((q) => {
          answers[q.id] = {
            questionId: q.id,
            selected: null,
            status: "notVisited",
          };
        });
        set({
          questions: sorted,
          answers,
          currentQuestionId: sorted[0]?.id ?? null,
          currentSubject: sorted[0]?.subject ?? "Mathematics",
        });
      },

      addQuestions: (qs) => {
        if (qs.length === 0) return;
        set((state) => {
          const byId = new Map<string, Question>();
          for (const q of state.questions) byId.set(q.id, q);
          for (const q of qs) byId.set(q.id, q);
          const merged = sortQuestions(Array.from(byId.values()));
          const answers = { ...state.answers };
          for (const q of merged) {
            if (!answers[q.id]) {
              answers[q.id] = {
                questionId: q.id,
                selected: null,
                status: "notVisited",
              };
            }
          }
          return {
            questions: merged,
            answers,
            currentQuestionId: state.currentQuestionId ?? merged[0]?.id ?? null,
            currentSubject:
              state.questions.length === 0
                ? merged[0]?.subject ?? "Mathematics"
                : state.currentSubject,
          };
        });
      },

      setParseStatus: (s) => set({ parseStatus: s }),

      startExam: () => {
        const { questions } = get();
        if (questions.length === 0) return;
        set({
          startedAt: Date.now(),
          submittedAt: null,
          currentQuestionId: questions[0].id,
          currentSubject: questions[0].subject,
        });
      },

      setCurrentSubject: (s) => {
        const { questions } = get();
        const first = questions.find((q) => q.subject === s);
        set({
          currentSubject: s,
          currentQuestionId: first?.id ?? null,
        });
        if (first) get().visit(first.id);
      },

      setCurrentQuestion: (id) => {
        set({ currentQuestionId: id });
        get().visit(id);
      },

      visit: (id) => {
        set((state) => {
          const a = state.answers[id];
          if (!a || a.status !== "notVisited") return state;
          return {
            answers: {
              ...state.answers,
              [id]: { ...a, status: "notAnswered" },
            },
          };
        });
      },

      selectAnswer: (id, value) => {
        set((state) => {
          const a = state.answers[id] ?? {
            questionId: id,
            selected: null,
            status: "notAnswered",
          };
          return {
            answers: {
              ...state.answers,
              [id]: { ...a, selected: value },
            },
          };
        });
      },

      clearAnswer: (id) => {
        set((state) => {
          const a = state.answers[id];
          if (!a) return state;
          return {
            answers: {
              ...state.answers,
              [id]: { ...a, selected: null, status: "notAnswered" },
            },
          };
        });
      },

      saveAndNext: (id) => {
        set((state) => {
          const a = state.answers[id];
          if (!a) return state;
          const isAnswered = a.selected !== null && a.selected !== "";
          const newStatus =
            a.status === "markedReview" || a.status === "answeredMarked"
              ? isAnswered
                ? "answeredMarked"
                : "markedReview"
              : isAnswered
                ? "answered"
                : "notAnswered";
          return {
            answers: {
              ...state.answers,
              [id]: { ...a, status: newStatus },
            },
          };
        });
        const next = nextQuestionId(get().questions, id);
        if (next) get().setCurrentQuestion(next);
      },

      markAndNext: (id) => {
        set((state) => {
          const a = state.answers[id];
          if (!a) return state;
          const isAnswered = a.selected !== null && a.selected !== "";
          return {
            answers: {
              ...state.answers,
              [id]: {
                ...a,
                status: isAnswered ? "answeredMarked" : "markedReview",
              },
            },
          };
        });
        const next = nextQuestionId(get().questions, id);
        if (next) get().setCurrentQuestion(next);
      },

      submitExam: () => {
        set({ submittedAt: Date.now() });
      },

      reset: () => {
        set({
          questions: [],
          answers: {},
          currentSubject: "Mathematics",
          currentQuestionId: null,
          startedAt: null,
          submittedAt: null,
          parseStatus: "idle",
        });
      },
    }),
    {
      name: "jee-exam-state",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? (undefined as unknown as Storage)
          : window.sessionStorage
      ),
    }
  )
);
