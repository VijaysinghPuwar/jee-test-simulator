"use client";

import { useEffect, useState } from "react";

interface TimerProps {
  startedAt: number;
  durationSeconds: number;
  onTimeout: () => void;
}

function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function Timer({
  startedAt,
  durationSeconds,
  onTimeout,
}: TimerProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, durationSeconds - Math.floor((Date.now() - startedAt) / 1000))
  );

  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(
        0,
        durationSeconds - Math.floor((Date.now() - startedAt) / 1000)
      );
      setRemaining(r);
      if (r === 0) {
        clearInterval(id);
        onTimeout();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt, durationSeconds, onTimeout]);

  const cls =
    remaining <= 300
      ? "text-red-600 bg-red-50 border-red-200"
      : remaining <= 900
        ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-slate-700 bg-slate-50 border-slate-200";

  return (
    <div
      className={`rounded-md border px-3 py-1.5 text-sm font-mono font-medium tabular-nums ${cls}`}
    >
      Time Left: {fmt(remaining)}
    </div>
  );
}
