import type {
  AnswerState,
  ExamConfig,
  ExamResult,
  Question,
  Subject,
  SubjectResult,
} from "./types";

const SUBJECTS: Subject[] = ["Mathematics", "Physics", "Chemistry"];

function normalize(value: string | null | undefined): string {
  if (value == null) return "";
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function isCorrect(question: Question, userAnswer: string | null): boolean {
  if (userAnswer == null) return false;
  const ua = normalize(userAnswer);
  const ca = normalize(question.correctAnswer);
  if (!ua || !ca) return false;
  if (question.type === "numerical") {
    const uaNum = Number(ua);
    const caNum = Number(ca);
    if (!Number.isNaN(uaNum) && !Number.isNaN(caNum)) {
      return Math.abs(uaNum - caNum) < 1e-6;
    }
  }
  return ua === ca;
}

export function gradeExam(
  questions: Question[],
  answers: Record<string, AnswerState>,
  config: ExamConfig
): ExamResult {
  const perQuestion = questions.map((q) => {
    const a = answers[q.id];
    const selected = a?.selected ?? null;
    const attempted = selected !== null && selected !== "";
    const correct = attempted && isCorrect(q, selected);
    const marks = attempted
      ? correct
        ? config.positiveMark
        : -config.negativeMark
      : 0;
    return { question: q, userAnswer: selected, isCorrect: correct, marks };
  });

  const subjects: SubjectResult[] = SUBJECTS.map((subject) => {
    const subQs = perQuestion.filter((r) => r.question.subject === subject);
    const total = subQs.length;
    const correct = subQs.filter((r) => r.isCorrect).length;
    const attempted = subQs.filter(
      (r) => r.userAnswer !== null && r.userAnswer !== ""
    ).length;
    const wrong = attempted - correct;
    const unattempted = total - attempted;
    const score = subQs.reduce((sum, r) => sum + r.marks, 0);
    const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
    return {
      subject,
      total,
      attempted,
      correct,
      wrong,
      unattempted,
      score,
      accuracy,
    };
  });

  const totalScore = subjects.reduce((s, r) => s + r.score, 0);
  const maxScore = questions.length * config.positiveMark;

  return { totalScore, maxScore, subjects, perQuestion };
}
