export type Subject = "Mathematics" | "Physics" | "Chemistry";
export type SectionType = "mcq" | "numerical";

export interface Question {
  id: string;
  subject: Subject;
  section: "I" | "II";
  type: SectionType;
  questionText: string;
  questionImage?: string;
  options?: string[];
  correctAnswer: string;
}

export type AnswerStatus =
  | "notVisited"
  | "notAnswered"
  | "answered"
  | "markedReview"
  | "answeredMarked";

export interface AnswerState {
  questionId: string;
  selected: string | null;
  status: AnswerStatus;
}

export interface ExamConfig {
  type: "JEE_MAIN";
  totalQuestions: number;
  durationSeconds: number;
  positiveMark: number;
  negativeMark: number;
}

export const JEE_MAIN_CONFIG: ExamConfig = {
  type: "JEE_MAIN",
  totalQuestions: 75,
  durationSeconds: 3 * 60 * 60,
  positiveMark: 4,
  negativeMark: 1,
};

export interface SubjectResult {
  subject: Subject;
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  score: number;
  accuracy: number;
}

export interface ExamResult {
  totalScore: number;
  maxScore: number;
  subjects: SubjectResult[];
  perQuestion: Array<{
    question: Question;
    userAnswer: string | null;
    isCorrect: boolean;
    marks: number;
  }>;
}
