"use client";

import { useRef, useState } from "react";

interface DropzoneProps {
  label: string;
  accept?: string;
  file: File | null;
  onFile: (f: File | null) => void;
}

export default function Dropzone({
  label,
  accept = "application/pdf",
  file,
  onFile,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && (!accept || f.type === accept)) onFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={`group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition cursor-pointer ${
        isOver
          ? "border-brand-600 bg-brand-50"
          : "border-slate-300 hover:border-brand-500 hover:bg-slate-50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {file ? (
        <div className="text-xs text-slate-500">
          <div className="font-medium text-slate-800">{file.name}</div>
          <div>{(file.size / 1024).toFixed(0)} KB</div>
        </div>
      ) : (
        <div className="text-xs text-slate-400">
          Click or drop a PDF here
        </div>
      )}
    </div>
  );
}
