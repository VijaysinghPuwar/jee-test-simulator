"use client";

import * as pdfjsLib from "pdfjs-dist";
import type {
  PDFPageProxy,
  TextItem,
} from "pdfjs-dist/types/src/display/api";

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
export const MAX_PAGE_IMAGE_COUNT = 32;
export const MAX_PAGE_IMAGE_DATA_URL_LENGTH = 130_000;

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
  imageDataUrl?: string;
}

export interface ExtractedPdfContent {
  text: string;
  pages: ExtractedPdfPage[];
}

interface ExtractPdfContentOptions {
  includePageImages?: boolean;
}

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

function cleanLines(lines: string[]): string {
  return lines
    .map((l) => l.replace(/[ \t]{2,}/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

async function extractPageText(page: PDFPageProxy): Promise<string> {
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
  return cleanLines(lines);
}

async function renderPageImage(page: PDFPageProxy): Promise<string | undefined> {
  if (typeof document === "undefined") return undefined;

  const baseViewport = page.getViewport({ scale: 1 });
  let scale = Math.min(1.35, 1000 / baseViewport.width);
  let quality = 0.66;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return undefined;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    canvas.width = 0;
    canvas.height = 0;
    if (dataUrl.length <= MAX_PAGE_IMAGE_DATA_URL_LENGTH) return dataUrl;
    scale *= 0.8;
    quality = Math.max(0.44, quality - 0.08);
  }

  return undefined;
}

export async function extractPdfContent(
  file: File,
  options: ExtractPdfContentOptions = {}
): Promise<ExtractedPdfContent> {
  await validatePdfFile(file);
  ensureWorker();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];
  const pages: ExtractedPdfPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const cleaned = await extractPageText(page);
    const pageInfo: ExtractedPdfPage = { pageNumber: i, text: cleaned };
    pageTexts.push(`--- Page ${i} ---\n${cleaned}`);
    if (options.includePageImages && pages.length < MAX_PAGE_IMAGE_COUNT) {
      pageInfo.imageDataUrl = await renderPageImage(page);
    }
    pages.push(pageInfo);
    page.cleanup();
  }
  await pdf.destroy();
  const joined = pageTexts.join("\n\n");
  const text =
    joined.length > MAX_EXTRACT_LENGTH
      ? joined.slice(0, MAX_EXTRACT_LENGTH)
      : joined;
  if (text.trim().length < 50 && pages.every((p) => !p.imageDataUrl)) {
    throw new Error(
      "Extracted text is unexpectedly short. The PDF may be scanned/image-only."
    );
  }
  return { text, pages };
}

export async function extractPdfText(file: File): Promise<string> {
  const content = await extractPdfContent(file);
  return content.text;
}
