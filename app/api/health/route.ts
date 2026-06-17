import { NextResponse } from "next/server";
import { checkServerEnv } from "@/lib/env-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const env = checkServerEnv();
  return NextResponse.json(
    {
      ok: env.ok,
      missing: env.missing,
      warnings: env.warnings,
      timestamp: new Date().toISOString(),
    },
    { status: env.ok ? 200 : 503 }
  );
}
