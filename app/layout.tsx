import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import Providers from "@/components/Providers";
import SetupRequired from "@/components/SetupRequired";
import { checkServerEnv } from "@/lib/env-check";

export const metadata: Metadata = {
  title: "JEE Test Simulator",
  description: "NTA-style JEE Main computer-based test simulator (BYOK)",
};

const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch (_) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const env = checkServerEnv();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {env.ok ? (
          <Providers>{children}</Providers>
        ) : (
          <SetupRequired status={env} />
        )}
      </body>
    </html>
  );
}
