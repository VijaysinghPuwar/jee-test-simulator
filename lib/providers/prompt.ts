import type { Subject } from "@/lib/types";

export const SYSTEM_PROMPT_BASE = `You convert JEE Main exam paper text into structured JSON.

You will receive two blocks of plain text extracted from PDFs:
1. QUESTION_PAPER_TEXT — the full paper (typically 75 questions: 25 Mathematics, 25 Physics, 25 Chemistry; Section I = single-correct MCQ, Section II = numerical).
2. ANSWER_KEY_TEXT — the official answer key / solutions, listing the correct answer per question.

You may also receive page images from the original PDFs. When page images are attached, use them as the source of truth for formulas, symbols, diagrams, chemical structures, reaction schemes, and option text. The extracted text often misses these details.

NOTE: The QP text is extracted from PDF and contains extra whitespace and broken line breaks within equations. Reassemble math sensibly. The answer key is often a compact table of question_number -> answer pairs (1-indexed within the full paper: Math = 1-25, Physics = 26-50, Chemistry = 51-75 in many papers).

Return ONLY a strict JSON array (no markdown, no code fences, no commentary). Begin with [ and end with ].

Each item must be:
{
  "id": "<S><N>",                  // S = M|P|C, N = 1..25 within the subject
  "subject": "Mathematics" | "Physics" | "Chemistry",
  "section": "I" | "II",
  "type": "mcq" | "numerical",
  "questionText": "<plain question; use $...$ for inline LaTeX>",
  "options": ["...","...","...","..."],   // only for type=mcq, exactly 4 items
  "correctAnswer": "<for mcq: '1'|'2'|'3'|'4'; for numerical: numeric string>"
}

Rules:
- Match each question's correctAnswer using ANSWER_KEY_TEXT. If unclear, set "correctAnswer" to "".
- For mcq, options are the 4 choices (1)(2)(3)(4) in order, without the leading numeral/parenthesis.
- For numerical, omit the "options" field.
- Preserve mathematical formulas using LaTeX delimiters, e.g. $x^2$, $\\frac{a}{b}$, $\\begin{cases}...\\end{cases}$.
- Preserve chemical formulas with Unicode subscripts/superscripts when simple (H₂SO₄, Fe³⁺) or LaTeX when needed.
- For diagrams or reaction schemes, describe the visible diagram/reaction in enough text that a student can answer the question. Do not leave only "(1)", "(2)", "(3)", "(4)" as options.
- Never use generic instructions like "Only One Option Correct Type" or "Each question has multiple options..." as the questionText.
- Output ONLY the JSON array.`;

export const SUBJECT_LETTER: Record<Subject, "M" | "P" | "C"> = {
  Mathematics: "M",
  Physics: "P",
  Chemistry: "C",
};

export function subjectSystemPrompt(subject: Subject): string {
  const letter = SUBJECT_LETTER[subject];
  return `${SYSTEM_PROMPT_BASE}

THIS REQUEST: Extract ONLY ${subject} questions (skip every question for other subjects).
You MUST return EXACTLY 25 question objects for ${subject}:
  - 20 in Section I (single-correct MCQ, ids ${letter}1..${letter}20, each with 4 options)
  - 5 in Section II (numerical, ids ${letter}21..${letter}25, NO options field)
- Every item must have "subject": "${subject}" and id starting with "${letter}".
- If a question is unclear, transcribe the best visible details from the page image/text; do not emit a generic stub.
- Do NOT skip questions. Do NOT stop early. Return all 25 items.`;
}

export function buildUserPrompt(
  qp: string,
  ak: string,
  subject?: Subject,
  imageContext?: string
): string {
  const header = subject
    ? `Extract ALL 25 ${subject} questions and match each against the answer key.`
    : "Extract all 75 questions and match each against the answer key.";
  return `${header}${imageContext ? `\n\n${imageContext}` : ""}\n\nQUESTION_PAPER_TEXT:\n\n${qp}\n\n---\n\nANSWER_KEY_TEXT:\n\n${ak}\n\n---\n\nReturn ONLY the JSON array.`;
}
