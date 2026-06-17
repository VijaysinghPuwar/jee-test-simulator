import { cookies } from "next/headers";
import { decrypt, encrypt } from "./crypto";

export const PROVIDERS = ["anthropic", "openai", "gemini"] as const;
export type Provider = (typeof PROVIDERS)[number];

export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDERS as readonly string[]).includes(value);
}

const COOKIE_NAME = "jee_byok";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

interface StoredKey {
  provider: Provider;
  apiKey: string;
}

interface CookiePayload {
  provider: Provider;
  enc: string;
}

export async function saveKey(
  userId: string,
  provider: Provider,
  apiKey: string
): Promise<void> {
  const enc = encrypt(apiKey, userId);
  const payload: CookiePayload = { provider, enc };
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function loadKey(userId: string): Promise<StoredKey | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as CookiePayload;
    if (!isProvider(payload.provider) || typeof payload.enc !== "string") {
      return null;
    }
    const apiKey = decrypt(payload.enc, userId);
    return { provider: payload.provider, apiKey };
  } catch {
    return null;
  }
}

export async function getStoredMeta(
  userId: string
): Promise<{ provider: Provider; last4: string } | null> {
  const k = await loadKey(userId);
  if (!k) return null;
  const trimmed = k.apiKey.trim();
  const last4 =
    trimmed.length <= 4 ? "•".repeat(trimmed.length) : trimmed.slice(-4);
  return { provider: k.provider, last4 };
}

export async function clearKey(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
