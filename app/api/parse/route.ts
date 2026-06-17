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

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

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
        headers: {
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
        },
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

  let rawText: string;
  try {
    rawText = await parseWithProvider(stored.provider, stored.apiKey, {
      questionPaperText: parsed.data.questionPaperText,
      answerKeyText: parsed.data.answerKeyText,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Provider error: ${message}` },
      { status: 502 }
    );
  }

  let parsedArr: unknown;
  try {
    parsedArr = extractJsonArray(rawText);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Could not parse model output: ${message}` },
      { status: 502 }
    );
  }

  const validated = QuestionsArraySchema.safeParse(parsedArr);
  if (!validated.success) {
    return NextResponse.json(
      {
        error: `Model output failed schema validation: ${
          validated.error.issues[0]?.message ?? "unknown"
        }`,
      },
      { status: 502 }
    );
  }

  const questions: ValidatedQuestion[] = validated.data;
  return NextResponse.json({ questions });
}
