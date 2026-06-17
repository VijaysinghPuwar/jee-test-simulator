"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";

type Provider = "anthropic" | "openai" | "gemini";

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic — claude-sonnet-4-6",
  openai: "OpenAI — gpt-4.1-mini",
  gemini: "Google — gemini-2.0-flash",
};

interface StoredKey {
  provider: Provider;
  last4: string;
}

export default function SettingsPage() {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [stored, setStored] = useState<StoredKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = (await res.json()) as { key: StoredKey | null };
        setStored(data.key);
        if (data.key) setProvider(data.key.provider);
      }
    } finally {
      setLoading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save key");
      }
      setApiKey("");
      setSavedAt(Date.now());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch("/api/keys", { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <header className="mb-8">
            <div className="text-xs font-medium uppercase tracking-wider text-brand-600">
              Settings
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Provider & API Key
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Choose your provider and enter your API key. Keys are encrypted
              with AES-256-GCM on the server and bound to your session. They are
              only used to make your own parsing requests.
            </p>
          </header>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {loading ? (
              <div className="text-sm text-slate-500">Loading…</div>
            ) : (
              <>
                {stored && (
                  <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium text-emerald-900">
                        Key configured ·{" "}
                        {PROVIDER_LABELS[stored.provider]}
                      </div>
                      <div className="text-xs text-emerald-700">
                        Ends in {stored.last4}
                      </div>
                    </div>
                    <button
                      onClick={remove}
                      disabled={busy}
                      className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <form onSubmit={save} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      Provider
                    </label>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value as Provider)}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                    >
                      {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      API Key
                    </label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        provider === "anthropic"
                          ? "sk-ant-…"
                          : provider === "openai"
                            ? "sk-…"
                            : "AI…"
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                    />
                  </div>

                  {error && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {error}
                    </div>
                  )}
                  {savedAt && !error && (
                    <div className="text-xs text-emerald-700">Key saved.</div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={busy || apiKey.trim().length < 8}
                      className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Save Key"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>

          <p className="mt-4 text-xs text-slate-500">
            Anthropic API keys at{" "}
            <code>console.anthropic.com</code>, OpenAI at{" "}
            <code>platform.openai.com</code>, Gemini at{" "}
            <code>aistudio.google.com</code>.
          </p>
        </div>
      </main>
    </>
  );
}
