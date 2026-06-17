import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import SetupRequired from "@/components/SetupRequired";
import { checkServerEnv } from "@/lib/env-check";

export const metadata: Metadata = {
  title: "JEE Test Simulator",
  description: "NTA-style JEE Main computer-based test simulator (BYOK)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const env = checkServerEnv();
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        {env.ok ? (
          <Providers>{children}</Providers>
        ) : (
          <SetupRequired status={env} />
        )}
      </body>
    </html>
  );
}
