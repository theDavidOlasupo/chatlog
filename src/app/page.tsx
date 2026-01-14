"use client";

import { useEffect, useRef, useState } from "react";
import Uploader from "./components/Uploader";
import Viewer from "./components/Viewer";
import ChatPanel from "./components/ChatPanel";
import { LogEntry, ParsingStats } from "../lib/types";

type WorkerProgress = {
  type: "PROGRESS";
  payload: {
    bytesProcessed: number;
    totalBytes: number;
    percent: number;
    lines: number;
    entries: number;
  };
};

type WorkerDone = {
  type: "DONE";
  payload: {
    entries: LogEntry[];
    stats: ParsingStats;
  };
};

type WorkerError = {
  type: "ERROR";
  error: string;
};

type WorkerResponse = WorkerProgress | WorkerDone | WorkerError;

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB

export default function Home() {
  const workerRef = useRef<Worker | null>(null);
  const uploadRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState<ParsingStats | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const scrollToSection = (section: "upload" | "chat") => {
    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
      // Wait for sidebar animation to complete before scrolling
      setTimeout(() => {
        const ref = section === "upload" ? uploadRef : chatRef;
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 350);
    } else {
      const ref = section === "upload" ? uploadRef : chatRef;
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/parse.worker.ts", import.meta.url)
    );

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;

      if (data.type === "PROGRESS") {
        setProgress(Math.round(data.payload.percent * 100));
      } else if (data.type === "DONE") {
        setIsParsing(false);
        setProgress(100);
        setEntries(data.payload.entries);
        setStats(data.payload.stats);
      } else if (data.type === "ERROR") {
        setIsParsing(false);
        setError(data.error);
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const handleFile = (file: File) => {
    if (!workerRef.current) return;

    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum size is 30MB, got ${(file.size / (1024 * 1024)).toFixed(1)}MB`);
      return;
    }

    // Reset state
    setIsParsing(true);
    setProgress(0);
    setError(null);
    setEntries([]);
    setSelectedEntries(new Set());
    setStats(null);

    workerRef.current.postMessage({ type: "parse", file });
  };

  const handleSelectionChange = (index: number, selected: boolean) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  };

  const handleSelectAll = (indices: number[]) => {
    setSelectedEntries(new Set(indices));
  };

  const handleClearSelection = () => {
    setSelectedEntries(new Set());
  };

  // Get the actual selected entry objects
  const selectedEntryObjects = entries.filter((_, idx) => selectedEntries.has(idx));

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="border-b border-blue-200 bg-gradient-to-r from-blue-50 to-white px-6 py-4">
        <h1 className="text-xl font-semibold">
          <span className="text-blue-600">C</span>
          <span className="text-red-600">h</span>
          <span className="text-yellow-500">a</span>
          <span className="text-blue-600">t</span>
          <span className="text-green-600">l</span>
          <span className="text-red-600">o</span>
          <span className="text-blue-600">g</span>
        </h1>
        <p className="text-sm font-semibold text-neutral-600">
          Explore log files by severity, search logs, get log insights via AI chat.
        </p>
        <p className="text-sm text-neutral-600">
         <a href="https://github.com/theDavidOlasupo/chatlog/blob/main/README.md" className="hover:underline" target="_blank" rel="noopener noreferrer">
           View <span className="font-semibold text-blue-600">Github repo</span> - see how to contribute features or use locally
         </a>
        </p>
      </header>

      <div className="mx-auto max-w-[1600px] h-[calc(100vh-100px)] p-3">
        <div className="relative flex gap-6 h-full">
          {/* Main panel: Viewer */}
          <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? "lg:mr-[400px]" : ""}`}>
            <Viewer
              entries={entries}
              selectedEntries={selectedEntries}
              onSelectionChange={handleSelectionChange}
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
            />
          </div>

          {/* Stacked icon buttons - always visible */}
          <div
            className={`fixed top-1/2 z-20 -translate-y-1/2 flex flex-col gap-1 transition-all duration-300 ${
              isSidebarOpen ? "right-[408px]" : "right-2"
            }`}
          >
            <button
              onClick={() => scrollToSection("upload")}
              className="flex h-12 w-12 items-center justify-center rounded-lg bg-white border border-neutral-200 text-neutral-600 shadow-md hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors"
              title="Upload"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </button>
            <button
              onClick={() => scrollToSection("chat")}
              className="flex h-12 w-12 items-center justify-center rounded-lg bg-white border border-neutral-200 text-neutral-600 shadow-md hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors"
              title="Chat"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
            {isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-500 shadow-md hover:bg-neutral-200 hover:text-neutral-700 transition-colors"
                title="Close panel"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Right panel: Upload + Chat (sidebar) */}
          <div
            ref={sidebarRef}
            className={`fixed right-0 top-[73px] bottom-0 w-[400px] overflow-y-auto border-l border-neutral-200 bg-neutral-50 p-3 transition-transform duration-300 ${
              isSidebarOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex flex-col gap-6 h-full">
              <div ref={uploadRef}>
                <Uploader
                  onFile={handleFile}
                  isParsing={isParsing}
                  progress={progress}
                  error={error}
                  stats={stats}
                />
              </div>
              <div ref={chatRef} className="flex-1 flex">
                <ChatPanel
                  entries={entries}
                  selectedEntries={selectedEntryObjects}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}