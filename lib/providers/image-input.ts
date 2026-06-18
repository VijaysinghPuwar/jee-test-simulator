import type { Subject } from "@/lib/types";

export interface PageImageInput {
  pageNumber: number;
  text: string;
  dataUrl: string;
}

export interface ParsedImageDataUrl {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
}

const SUBJECTS: Subject[] = ["Mathematics", "Physics", "Chemistry"];

export function parseImageDataUrl(dataUrl: string): ParsedImageDataUrl {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  return {
    mediaType: match[1] as ParsedImageDataUrl["mediaType"],
    base64: match[2],
  };
}

function hasSubjectHeading(text: string, subject: Subject): boolean {
  const escaped = subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `${escaped}\\s+(?:Max\\s+Marks|Single\\s+Correct|Numerical|SECTION)`,
    "i"
  ).test(text);
}

function hasQuestionSignal(text: string): boolean {
  return /(?:Question\s+No\.?|SECTION-|^\s*\d{1,2}\.)/im.test(text);
}

export function pickSubjectPageImages(
  pages: PageImageInput[] | undefined,
  subject: Subject
): PageImageInput[] {
  if (!pages?.length) return [];
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const start = sorted.findIndex((page) => hasSubjectHeading(page.text, subject));
  if (start === -1) {
    return sorted.filter((page) => hasQuestionSignal(page.text)).slice(0, 12);
  }

  const otherSubjects = SUBJECTS.filter((s) => s !== subject);
  let end = sorted.length - 1;
  for (let i = start + 1; i < sorted.length; i += 1) {
    const text = sorted[i].text;
    if (
      otherSubjects.some((other) => hasSubjectHeading(text, other)) &&
      !hasSubjectHeading(text, subject)
    ) {
      end = i - 1;
      break;
    }
  }

  return sorted.slice(start, end + 1).slice(0, 12);
}

export function pageImageContext(
  questionPages: PageImageInput[],
  answerPages: PageImageInput[]
): string {
  const lines: string[] = [];
  if (questionPages.length > 0) {
    lines.push(
      `Question paper page images are attached for pages: ${questionPages
        .map((page) => page.pageNumber)
        .join(", ")}. Use them as the source of truth for formulas, diagrams, chemical structures, symbols, and option text.`
    );
  }
  if (answerPages.length > 0) {
    lines.push(
      `Answer key / solution page images are attached for pages: ${answerPages
        .map((page) => page.pageNumber)
        .join(", ")}.`
    );
  }
  return lines.join("\n");
}
