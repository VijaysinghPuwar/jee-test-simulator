"use client";

import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

let workerInitialized = false;

function ensureWorker() {
  if (workerInitialized) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  workerInitialized = true;
}

export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACT_LENGTH = 100_000;

const PDF_MAGIC = "%PDF-";

export async function validatePdfFile(file: File): Promise<void> {
  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new Error(
      `File "${file.name}" is larger than ${MAX_PDF_SIZE_BYTES / 1024 / 1024} MB.`
    );
  }
  if (file.type && file.type !== "application/pdf") {
    throw new Error(`File "${file.name}" is not a PDF.`);
  }
  const head = await file.slice(0, 5).text();
  if (head !== PDF_MAGIC) {
    throw new Error(
      `File "${file.name}" failed PDF magic-byte check; it may be corrupted.`
    );
  }
}

export async function extractPdfText(file: File): Promise<string> {
  await validatePdfFile(file);
  ensureWorker();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let current = "";
    let prevY: number | null = null;
    for (const item of content.items as TextItem[]) {
      if (!("str" in item)) continue;
      const y = item.transform?.[5];
      if (
        prevY != null &&
        typeof y === "number" &&
        Math.abs(y - prevY) > 2
      ) {
        if (current.trim()) lines.push(current.trim());
        current = "";
      }
      current += item.str + (item.hasEOL ? "\n" : " ");
      if (typeof y === "number") prevY = y;
    }
    if (current.trim()) lines.push(current.trim());
    pages.push(`--- Page ${i} ---\n${lines.join("\n")}`);
    page.cleanup();
    if (pages.join("\n\n").length > MAX_EXTRACT_LENGTH) break;
  }
  await pdf.destroy();
  const joined = pages.join("\n\n");
  if (joined.length > MAX_EXTRACT_LENGTH) {
    return joined.slice(0, MAX_EXTRACT_LENGTH);
  }
  if (joined.trim().length < 50) {
    throw new Error(
      "Extracted text is unexpectedly short. The PDF may be scanned/image-only."
    );
  }
  return joined;
}
