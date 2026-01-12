/// <reference lib="webworker" />

import { LogEntry } from "../lib/types";

type ParseRequest = {
  type: "parse";
  file: File;
};

type ProgressMessage = {
  type: "PROGRESS";
  payload: {
    bytesProcessed: number;
    totalBytes: number;
    percent: number;
    lines: number;
    entries: number;
  };
};

type DoneMessage = {
  type: "DONE";
  payload: {
    entries: LogEntry[];
    stats: {
      bytesProcessed: number;
      totalBytes: number;
      lines: number;
      entries: number;
      durationMs: number;
    };
  };
};

type ErrorMessage = {
  type: "ERROR";
  error: string;
};

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
const SLICE_SIZE = 256 * 1024; // 256 KB per read to avoid loading full file
const PROGRESS_INTERVAL_BYTES = 1 * 1024 * 1024; // send progress roughly every MB

ctx.onmessage = (event: MessageEvent<ParseRequest>) => {
  if (event.data?.type !== "parse" || !event.data.file) return;
  parseFile(event.data.file).catch((err) => {
    const message: ErrorMessage = {
      type: "ERROR",
      error: err instanceof Error ? err.message : "Unknown worker error",
    };
    ctx.postMessage(message);
  });
};

async function parseFile(file: File) {
  const entries: LogEntry[] = [];
  let currentEntry: { startLine: number; lines: string[] } | null = null;

  let bytesProcessed = 0;
  let lastProgressAt = 0;
  let lineNumber = 0;
  let leftover = "";
  const decoder = new TextDecoder();
  const startTime = performance.now();

  while (bytesProcessed < file.size) {
    const slice = file.slice(bytesProcessed, bytesProcessed + SLICE_SIZE);
    const buffer = await slice.arrayBuffer();
    const text = decoder.decode(buffer, { stream: true });
    leftover = processText(leftover + text);
    bytesProcessed += buffer.byteLength;

    if (bytesProcessed - lastProgressAt >= PROGRESS_INTERVAL_BYTES || bytesProcessed >= file.size) {
      lastProgressAt = bytesProcessed;
      const progressMessage: ProgressMessage = {
        type: "PROGRESS",
        payload: {
          bytesProcessed,
          totalBytes: file.size,
          percent: Math.min(1, bytesProcessed / file.size),
          lines: lineNumber,
          entries: entries.length,
        },
      };
      ctx.postMessage(progressMessage);
    }
  }

  // flush decoder and leftover line
  const finalText = decoder.decode();
  if (finalText) {
    leftover = processText(leftover + finalText);
  }
  if (leftover) {
    handleLine(leftover);
    leftover = "";
  }
  finalizeEntry();

  const durationMs = performance.now() - startTime;
  const doneMessage: DoneMessage = {
    type: "DONE",
    payload: {
      entries,
      stats: {
        bytesProcessed,
        totalBytes: file.size,
        lines: lineNumber,
        entries: entries.length,
        durationMs,
      },
    },
  };

  ctx.postMessage(doneMessage);

  function processText(bufferText: string) {
    const lines = bufferText.split(/\r?\n/);
    const trailing = lines.pop() ?? "";
    for (const line of lines) {
      handleLine(line);
    }
    return trailing;
  }

  function handleLine(line: string) {
    lineNumber += 1;
    const isStart = isEntryStart(line);
    const isContinuation = isContinuationLine(line);

    if (!currentEntry) {
      currentEntry = { startLine: lineNumber, lines: [line] };
      return;
    }

    if (isStart && !isContinuation) {
      finalizeEntry();
      currentEntry = { startLine: lineNumber, lines: [line] };
    } else {
      currentEntry.lines.push(line);
    }
  }

  function finalizeEntry() {
    if (!currentEntry) return;
    const { startLine, lines } = currentEntry;
    const lineEnd = startLine + lines.length - 1;
    const text = lines.join("\n");
    const severity = detectSeverity(lines[0]);
    const timestamp = detectTimestamp(lines[0]);
    const entry: LogEntry = { lineStart: startLine, lineEnd, text, severity, timestamp };
    entries.push(entry);
    currentEntry = null;
  }

  function isEntryStart(line: string) {
    return detectTimestamp(line) !== undefined || detectSeverity(line) !== undefined || isJsonStart(line);
  }

  function isContinuationLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return true;
    return (
      /^\s/.test(line) ||
      /^at\s/.test(trimmed) ||
      /^Caused by/.test(trimmed) ||
      /^Traceback/.test(trimmed) ||
      /^File\s+"/.test(trimmed)
    );
  }

  function detectTimestamp(line: string) {
    const match = line.match(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?/);
    return match ? match[0] : undefined;
  }

  function detectSeverity(line: string) {
    const match = line.match(/\b(ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL)\b/i);
    return match ? match[1].toUpperCase() : undefined;
  }

  function isJsonStart(line: string) {
    return /^\s*\{/.test(line);
  }
}
