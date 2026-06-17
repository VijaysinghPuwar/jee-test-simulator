import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { loadKey } from "@/lib/key-store";
import { parseWithProvider } from "@/lib/providers";
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
export const dynamic = "force-dynamic";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const PER_SUBJECT_TIMEOUT_MS = 50_000;
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

async function parseSubject(
  provider: Provider,
  apiKey: string,
  qp: string,
  ak: string,
  subject: Subject
): Promise<ValidatedQuestion[]> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), PER_SUBJECT_TIMEOUT_MS);
  let raw: string;
  try {
    raw = await parseWithProvider(provider, apiKey, {
      questionPaperText: qp,
      answerKeyText: ak,
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
      `Schema validation failed for ${subject}: ${
        validated.error.issues[0]?.message ?? "unknown"
      }`
    );
  }
  return validated.data.filter((q) => q.subject === subject);
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

  const settled = await Promise.allSettled(
    SUBJECTS.map((s) => parseSubject(stored.provider, stored.apiKey, qp, ak, s))
  );

  const all: ValidatedQuestion[] = [];
  const errors: { subject: Subject; error: string }[] = [];
  settled.forEach((r, i) => {
    const subject = SUBJECTS[i];
    if (r.status === "fulfilled") {
      all.push(...r.value);
    } else {
      const message =
        r.reason instanceof Error ? r.reason.message : String(r.reason);
      errors.push({ subject, error: message });
    }
  });

  if (all.length === 0) {
    return NextResponse.json(
      {
        error:
          "All subjects failed to parse. " +
          errors.map((e) => `${e.subject}: ${e.error}`).join(" | "),
      },
      { status: 502 }
    );
  }

  const validated = QuestionsArraySchema.safeParse(all);
  if (!validated.success) {
    return NextResponse.json(
      {
        error: `Combined output failed schema validation: ${
          validated.error.issues[0]?.message ?? "unknown"
        }`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    questions: validated.data,
    partial: errors.length > 0 ? errors : undefined,
  });
}
