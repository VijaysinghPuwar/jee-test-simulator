import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { loadKey } from "@/lib/key-store";
import { parseWithProvider } from "@/lib/providers";
import {
  pickSubjectPageImages,
  type PageImageInput,
} from "@/lib/providers/image-input";
import { rateLimit } from "@/lib/rate-limit";
import {
  ParseRequestSchema,
  QuestionsArraySchema,
  type ValidatedQuestion,
} from "@/lib/validation";
import type { Provider } from "@/lib/key-store";
import type { Subject } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const PER_CALL_TIMEOUT_MS = 55_000;

const SUBJECTS: Subject[] = ["Mathematics", "Physics", "Chemistry"];

function extractJsonArray(raw: string): unknown {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  const startArr = text.indexOf("[");
  const endArr = text.lastIndexOf("]");
  if (startArr !== -1 && endArr > startArr) {
    return JSON.parse(text.slice(startArr, endArr + 1));
  }
  const startObj = text.indexOf("{");
  const endObj = text.lastIndexOf("}");
  if (startObj !== -1 && endObj > startObj) {
    const obj = JSON.parse(text.slice(startObj, endObj + 1)) as Record<
      string,
      unknown
    >;
    const arr = obj.questions ?? obj.items ?? obj.data ?? obj.result;
    if (Array.isArray(arr)) return arr;
  }
  throw new Error("Model output did not contain a JSON array");
}

function isPlaceholderOption(option: string): boolean {
  const normalized = option.trim();
  return /^(\(?[1-4]\)?|[A-D]|option\s*[1-4A-D]?)$/i.test(normalized);
}

function normalizedQuestionText(text: string): string {
  return text
    .replace(/Only One Option Correct Type/gi, "")
    .replace(/Each question has multiple options out of which ONLY ONE is correct\.?/gi, "")
    .replace(/Question No\.?\s*\d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isWeakQuestion(q: ValidatedQuestion): boolean {
  const text = normalizedQuestionText(q.questionText);
  if (text.length < 24) return true;
  if (/^(single correct|numerical type|section[-\s]?[i1]+)$/i.test(text)) {
    return true;
  }
  if (q.type === "mcq") {
    if (!q.options || q.options.length !== 4) return true;
    const meaningfulOptions = q.options.filter((o) => !isPlaceholderOption(o));
    if (meaningfulOptions.length < 2) return true;
  }
  return false;
}

function providerErrorMessage(e: unknown, subject: Subject): string {
  const message = e instanceof Error ? e.message : String(e);
  const name = e instanceof Error ? e.name : "";
  if (/abort|aborted|timeout|timed out/i.test(`${name} ${message}`)) {
    return `${subject} timed out after ${Math.round(
      PER_CALL_TIMEOUT_MS / 1000
    )}s. Try again, use a text-readable PDF, or switch provider/model in Settings.`;
  }
  return message;
}

async function parseSubject(
  provider: Provider,
  apiKey: string,
  qp: string,
  ak: string,
  subject: Subject,
  questionPaperPageImages: PageImageInput[],
  answerKeyPageImages: PageImageInput[]
): Promise<ValidatedQuestion[]> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), PER_CALL_TIMEOUT_MS);
  let raw: string;
  try {
    raw = await parseWithProvider(provider, apiKey, {
      questionPaperText: qp,
      answerKeyText: ak,
      questionPaperPageImages,
      answerKeyPageImages,
      subject,
      signal: ac.signal,
    });
  } finally {
    clearTimeout(t);
  }
  const parsed = extractJsonArray(raw);
  const validated = QuestionsArraySchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      validated.error.issues[0]?.message ?? "schema validation failed"
    );
  }
  const questions = validated.data.filter((q) => q.subject === subject);
  const weak = questions.filter(isWeakQuestion);
  if (questions.length !== 25 || weak.length > 2) {
    throw new Error(
      `Parsed ${subject} questions are incomplete (${questions.length}/25 total, ${weak.length} weak). Reparse with a vision-capable provider and page images enabled.`
    );
  }
  return questions;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`parse:${userId}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = ParseRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const stored = await loadKey(userId);
  if (!stored) {
    return NextResponse.json(
      { error: "No API key configured. Set one in Settings." },
      { status: 412 }
    );
  }

  const qp = parsed.data.questionPaperText;
  const ak = parsed.data.answerKeyText;
  const qpImages = parsed.data.questionPaperPageImages ?? [];
  const akImages = parsed.data.answerKeyPageImages ?? [];
  const subjects = parsed.data.subjects ?? SUBJECTS;
  const provider = stored.provider;
  const apiKey = stored.apiKey;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };

      send({ type: "start", total: subjects.length, provider });

      const tasks = subjects.map(async (subject) => {
        try {
          const subjectQuestionImages = pickSubjectPageImages(qpImages, subject);
          const subjectAnswerImages = pickSubjectPageImages(akImages, subject);
          const questions = await parseSubject(
            provider,
            apiKey,
            qp,
            ak,
            subject,
            subjectQuestionImages,
            subjectAnswerImages
          );
          send({
            type: "chunk",
            subject,
            count: questions.length,
            questions,
          });
        } catch (e) {
          send({
            type: "error",
            subject,
            error: providerErrorMessage(e, subject),
          });
        }
      });

      await Promise.allSettled(tasks);
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
