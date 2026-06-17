import type { EnvStatus } from "@/lib/env-check";

const HINTS: Record<string, string> = {
  NEXTAUTH_SECRET: "Generate with: openssl rand -base64 32",
  ENCRYPTION_KEY: "Generate with: openssl rand -hex 32  (must be 64 hex chars)",
  GOOGLE_CLIENT_ID: "From Google Cloud → APIs & Services → Credentials",
  GOOGLE_CLIENT_SECRET: "From the same OAuth client",
  NEXTAUTH_URL: "Your deployed origin, e.g. https://your-app.vercel.app",
};

export default function SetupRequired({ status }: { status: EnvStatus }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wider text-red-600">
          Setup required
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Missing environment variables
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          The server is missing required environment variables. Set them in your
          Vercel project (Settings → Environment Variables) and redeploy, or in
          a local <code className="font-mono text-xs">.env.local</code> file for
          local development.
        </p>

        {status.missing.length > 0 && (
          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Missing
            </div>
            <ul className="mt-2 space-y-2">
              {status.missing.map((k) => (
                <li
                  key={k}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <div className="font-mono font-medium text-slate-900">{k}</div>
                  {HINTS[k] && (
                    <div className="mt-0.5 text-xs text-slate-600">
                      {HINTS[k]}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {status.warnings.length > 0 && (
          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">
              Warnings
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">
              {status.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
          <div className="font-semibold text-slate-800">Vercel checklist</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Vercel → Project → Settings → Environment Variables.</li>
            <li>
              Add all of: <code>NEXTAUTH_SECRET</code>,{" "}
              <code>NEXTAUTH_URL</code>, <code>GOOGLE_CLIENT_ID</code>,{" "}
              <code>GOOGLE_CLIENT_SECRET</code>, <code>ENCRYPTION_KEY</code>.
            </li>
            <li>Apply to Production (and Preview if needed) and redeploy.</li>
            <li>
              Verify by hitting <code>/api/health</code>.
            </li>
          </ol>
        </div>
      </div>
    </main>
  );
}
