import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { clearKey, getStoredMeta, saveKey } from "@/lib/key-store";
import { SaveKeySchema } from "@/lib/validation";

export const runtime = "nodejs";

async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const meta = await getStoredMeta(userId);
  return NextResponse.json({ key: meta });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = SaveKeySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  await saveKey(userId, parsed.data.provider, parsed.data.apiKey.trim());
  const meta = await getStoredMeta(userId);
  return NextResponse.json({ key: meta });
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await clearKey();
  return NextResponse.json({ ok: true });
}
