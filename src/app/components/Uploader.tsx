"use client";

import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { ParsingStats } from "../../lib/types";

type Props = {
  onFile: (file: File) => void;
  isParsing: boolean;
  progress: number;
  error: string | null;
  stats: ParsingStats | null;
};

const Uploader = ({ onFile, isParsing, progress, error, stats }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(1)} ${units[i]}`;
  };

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-colors ${
          isDragOver
            ? "border-blue-500 bg-blue-50"
            : "border-neutral-300 bg-neutral-50 hover:border-neutral-400"
        } ${isParsing ? "pointer-events-none opacity-50" : ""}`}
      >
        <svg
          className={`h-6 w-6 flex-shrink-0 ${isDragOver ? "text-blue-500" : "text-neutral-400"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-neutral-600">
            <span className="font-medium text-blue-600">Upload</span> or drop log file
          </p>
          <p className="text-xs text-neutral-400">.log, .txt, .json up to 30MB</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".log,.txt,.json"
        onChange={handleChange}
        className="hidden"
        disabled={isParsing}
      />

      {/* Progress bar */}
      {isParsing && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-neutral-600">
            <span>Parsing...</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Stats after successful parse */}
      {stats && !isParsing && !error && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-medium text-green-800">
              {stats.entries.toLocaleString()} entries
            </span>
            <span className="text-green-600">
              {stats.lines.toLocaleString()} lines
            </span>
          </div>
          <span className="text-xs text-green-600">
            {formatBytes(stats.bytesProcessed)}
          </span>
        </div>
      )}
    </section>
  );
};

export default Uploader;
