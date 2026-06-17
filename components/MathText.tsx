"use client";

import katex from "katex";

interface MathTextProps {
  text: string;
  className?: string;
}

type Segment =
  | { type: "text"; value: string }
  | { type: "math"; value: string; display: boolean };

const MATH_PATTERN = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;

function splitMath(text: string): Segment[] {
  const parts: Segment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(MATH_PATTERN)) {
    const raw = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, index) });
    }
    const display = raw.startsWith("$$") || raw.startsWith("\\[");
    const value = raw.startsWith("$$")
      ? raw.slice(2, -2)
      : raw.startsWith("$")
        ? raw.slice(1, -1)
        : raw.slice(2, -2);
    parts.push({ type: "math", value, display });
    lastIndex = index + raw.length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts;
}

function renderKatex(value: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(value, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  } catch {
    return null;
  }
}

export default function MathText({ text, className }: MathTextProps) {
  return (
    <span className={className}>
      {splitMath(text).map((part, index) => {
        if (part.type === "text") {
          return <span key={index}>{part.value}</span>;
        }
        const html = renderKatex(part.value, part.display);
        if (!html) {
          return <span key={index}>{part.value}</span>;
        }
        return (
          <span
            key={index}
            className={part.display ? "my-2 block overflow-x-auto" : "inline"}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}
