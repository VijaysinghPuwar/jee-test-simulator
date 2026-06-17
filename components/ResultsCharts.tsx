"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExamResult } from "@/lib/types";

const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: "#2563eb",
  Physics: "#7c3aed",
  Chemistry: "#16a34a",
};

const DONUT_COLORS = {
  correct: "#16a34a",
  wrong: "#dc2626",
  skipped: "#9ca3af",
};

export function SubjectScoreBar({ result }: { result: ExamResult }) {
  const data = result.subjects.map((s) => ({
    subject: s.subject.slice(0, 4),
    score: s.score,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <XAxis dataKey="subject" stroke="#64748b" fontSize={12} />
        <YAxis stroke="#64748b" fontSize={12} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Bar dataKey="score" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={
                SUBJECT_COLORS[
                  result.subjects[i].subject as keyof typeof SUBJECT_COLORS
                ] ?? "#3b82f6"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ResponseDonut({ result }: { result: ExamResult }) {
  const totals = result.subjects.reduce(
    (acc, s) => {
      acc.correct += s.correct;
      acc.wrong += s.wrong;
      acc.skipped += s.unattempted;
      return acc;
    },
    { correct: 0, wrong: 0, skipped: 0 }
  );
  const data = [
    { name: "Correct", value: totals.correct, fill: DONUT_COLORS.correct },
    { name: "Wrong", value: totals.wrong, fill: DONUT_COLORS.wrong },
    { name: "Skipped", value: totals.skipped, fill: DONUT_COLORS.skipped },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Legend
          verticalAlign="bottom"
          height={28}
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
