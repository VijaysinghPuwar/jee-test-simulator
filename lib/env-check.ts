export interface EnvStatus {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

const REQUIRED = [
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "ENCRYPTION_KEY",
] as const;

export function checkServerEnv(): EnvStatus {
  const missing: string[] = [];
  const warnings: string[] = [];
  for (const k of REQUIRED) {
    const v = process.env[k];
    if (!v || v.trim().length === 0) missing.push(k);
  }
  const encKey = process.env.ENCRYPTION_KEY;
  if (encKey && encKey.length !== 64) {
    warnings.push("ENCRYPTION_KEY must be 64 hex characters (32 bytes).");
  }
  if (
    !process.env.NEXTAUTH_URL &&
    !process.env.VERCEL_URL &&
    process.env.NODE_ENV === "production"
  ) {
    warnings.push(
      "NEXTAUTH_URL is not set and VERCEL_URL is also missing — set NEXTAUTH_URL to your deployed origin."
    );
  }
  return { ok: missing.length === 0, missing, warnings };
}
