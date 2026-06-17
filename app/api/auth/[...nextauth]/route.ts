import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { checkServerEnv } from "@/lib/env-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = NextAuth(authOptions);

function setupGuard(): Response | null {
  const env = checkServerEnv();
  if (env.ok) return null;
  return NextResponse.json(
    {
      error: "Server is not configured.",
      missing: env.missing,
      hint: "Set the missing environment variables in Vercel and redeploy. See /api/health.",
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ nextauth: string[] }> }
) {
  const guard = setupGuard();
  if (guard) return guard;
  return handler(req, ctx);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ nextauth: string[] }> }
) {
  const guard = setupGuard();
  if (guard) return guard;
  return handler(req, ctx);
}
