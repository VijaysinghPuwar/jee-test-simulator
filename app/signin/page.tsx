"use client";

import { signIn } from "next-auth/react";
import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

function SignInInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const error = params.get("error");

  useEffect(() => {
    if (status === "authenticated") router.replace(callbackUrl);
  }, [status, callbackUrl, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wider text-brand-600">
          Sign in
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          JEE Test Simulator
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with Google to upload papers, configure your provider key, and
          take tests.
        </p>
        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Sign-in failed: {error}
          </div>
        )}
        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="mt-6 w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Continue with Google
        </button>
        <p className="mt-4 text-xs text-slate-500">
          Your API keys are encrypted with AES-256-GCM server-side and used only
          for your own requests.
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}
