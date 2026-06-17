"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

export default function NavBar() {
  const { data: session, status } = useSession();

  return (
    <nav className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          JEE Test Simulator
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {status === "authenticated" ? (
            <>
              <Link
                href="/settings"
                className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Settings
              </Link>
              <span className="hidden text-slate-500 sm:inline dark:text-slate-400">
                {session.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Sign out
              </button>
            </>
          ) : status === "unauthenticated" ? (
            <button
              onClick={() => signIn("google")}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
              Sign in with Google
            </button>
          ) : (
            <span className="text-xs text-slate-400">…</span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
