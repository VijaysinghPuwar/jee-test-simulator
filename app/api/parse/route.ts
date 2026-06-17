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
const PER_CALL_TIMEOUT_MS = 55_000;

interface Chunk {
  subject: Subject;
  section: "I" | "II";
}

const CHUNKS: Chunk[] = [
  { subject: "Mathematics", section: "I" },
  { subject: "Mathematics", section: "II" },
  { subject: "Physics", section: "I" },
  { subject: "Physics", section: "II" },
  { subject: "Chemistry", section: "I" },
  { subject: "Chemistry", section: "II" },
];

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

async function parseChunk(
  provider: Provider,
  apiKey: string,
  qp: string,
  ak: string,
  chunk: Chunk
): Promise<ValidatedQuestion[]> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), PER_CALL_TIMEOUT_MS);
  let raw: string;
  try {
    raw = await parseWithProvider(provider, apiKey, {
      questionPaperText: qp,
      answerKeyText: ak,
      subject: chunk.subject,
      section: chunk.section,
      signal: ac.signal,
    });
  } finally {
    clearTimeout(t);
  }
  const parsed = extractJsonArray(raw);
  const validated = QuestionsArraySchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Schema validation failed: ${
        validated.error.issues[0]?.message ?? "unknown"
      }`
    );
  }
  return validated.data.filter(
    (q) => q.subject === chunk.subject && q.section === chunk.section
  );
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
    CHUNKS.map((c) => parseChunk(stored.provider, stored.apiKey, qp, ak, c))
  );

  const all: ValidatedQuestion[] = [];
  const errors: { subject: Subject; section: "I" | "II"; error: string }[] = [];
  settled.forEach((r, i) => {
    const chunk = CHUNKS[i];
    if (r.status === "fulfilled") {
      all.push(...r.value);
    } else {
      const message =
        r.reason instanceof Error ? r.reason.message : String(r.reason);
      errors.push({ ...chunk, error: message });
    }
  });

  if (all.length === 0) {
    return NextResponse.json(
      {
        error:
          `All ${stored.provider} calls failed. ` +
          errors
            .map((e) => `${e.subject} §${e.section}: ${e.error}`)
            .slice(0, 3)
            .join(" | "),
        provider: stored.provider,
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
    provider: stored.provider,
    partial: errors.length > 0 ? errors : undefined,
  });
}
