"use client";

import { useEffect, useMemo, useState } from "react";
import { LogEntry } from "../../lib/types";

type Props = {
  entries: LogEntry[];
  selectedEntries: Set<number>;
  onSelectionChange: (index: number, selected: boolean) => void;
  onSelectAll: (indices: number[]) => void;
  onClearSelection: () => void;
};

type SeverityFilter = "ALL" | "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";

const SEVERITY_COLORS: Record<string, string> = {
  ERROR: "text-red-600",
  FATAL: "text-red-600",
  WARN: "text-yellow-600",
  WARNING: "text-yellow-600",
  INFO: "text-blue-600",
  DEBUG: "text-neutral-500",
  TRACE: "text-neutral-400",
};

const DEFAULT_LIMIT = 150;

const Viewer = ({
  entries,
  selectedEntries,
  onSelectionChange,
  onSelectAll,
  onClearSelection,
}: Props) => {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [displayLimit, setDisplayLimit] = useState(DEFAULT_LIMIT);
  const hasData = entries.length > 0;

  const indexedEntries = useMemo(() => {
    return entries.map((entry, index) => ({ entry, originalIndex: index }));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let result = indexedEntries;

    if (severityFilter !== "ALL") {
      result = result.filter(({ entry }) => {
        const sev = entry.severity?.toUpperCase();
        if (severityFilter === "WARN") {
          return sev === "WARN" || sev === "WARNING";
        }
        return sev === severityFilter;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(({ entry }) => entry.text.toLowerCase().includes(query));
    }

    return result;
  }, [indexedEntries, severityFilter, searchQuery]);

  useEffect(() => {
    setDisplayLimit(DEFAULT_LIMIT);
  }, [severityFilter, searchQuery]);

  const getSeverityColor = (severity?: string) => {
    if (!severity) return "text-neutral-600";
    return SEVERITY_COLORS[severity.toUpperCase()] || "text-neutral-600";
  };

  const displayedEntries = filteredEntries.slice(0, displayLimit);
  const hasMore = filteredEntries.length > displayLimit;

  const handleSelectAllVisible = () => {
    const visibleIndices = displayedEntries.map(({ originalIndex }) => originalIndex);
    onSelectAll(visibleIndices);
  };

  const handleShowMore = () => {
    setDisplayLimit((prev) => prev + 100);
  };

  const handleShowAll = () => {
    setDisplayLimit(filteredEntries.length);
  };

  const selectedCount = selectedEntries.size;

  // Format line number with padding for alignment
  const formatLineNum = (start: number, end: number) => {
    const lineStr = start === end ? `${start}` : `${start}-${end}`;
    return lineStr.padStart(6);
  };

  return (
    <section className="flex flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-neutral-900">Log Viewer</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={!hasData}
            className={`w-32 rounded border px-2 py-1 text-xs ${
              hasData
                ? "border-neutral-300 bg-white text-neutral-900 placeholder-neutral-400"
                : "border-neutral-200 bg-neutral-50 text-neutral-400"
            }`}
          />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
            disabled={!hasData}
            className={`rounded border border-neutral-300 px-2 py-1 text-xs ${
              hasData ? "bg-white text-neutral-900" : "bg-neutral-50 text-neutral-500"
            }`}
          >
            <option value="ALL">All</option>
            <option value="ERROR">ERROR</option>
            <option value="WARN">WARN</option>
            <option value="INFO">INFO</option>
            <option value="DEBUG">DEBUG</option>
            <option value="TRACE">TRACE</option>
          </select>
        </div>
      </div>

      {hasData && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-neutral-500">
            {filteredEntries.length.toLocaleString()} entries
            {selectedCount > 0 && (
              <span className="ml-2 font-medium text-blue-600">
                ({selectedCount} selected)
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAllVisible}
              className="text-blue-600 hover:text-blue-700"
            >
              Select visible
            </button>
            {selectedCount > 0 && (
              <button
                onClick={onClearSelection}
                className="text-neutral-500 hover:text-neutral-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-2 flex min-h-[400px] max-h-[calc(100vh-220px)] flex-col overflow-y-auto rounded border border-neutral-200 bg-neutral-900 font-mono text-xs">
        {hasData ? (
          filteredEntries.length > 0 ? (
            <div className="flex flex-col">
              {displayedEntries.map(({ entry, originalIndex }, idx) => {
                const isSelected = selectedEntries.has(originalIndex);
                const severityColor = getSeverityColor(entry.severity);
                const lines = entry.text.split("\n");
                const isMultiLine = lines.length > 1;

                return (
                  <div
                    key={`${entry.lineStart}-${originalIndex}`}
                    className={`group flex min-w-0 ${
                      isSelected
                        ? "bg-blue-900/40"
                        : idx % 2 === 0
                        ? "bg-neutral-900"
                        : "bg-neutral-800/50"
                    } hover:bg-blue-900/20`}
                  >
                    {/* Checkbox */}
                    <div className="flex-shrink-0 px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelectionChange(originalIndex, e.target.checked)}
                        className="h-3 w-3 rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-1 focus:ring-blue-500 focus:ring-offset-0"
                      />
                    </div>

                    {/* Line number */}
                    <span className="flex-shrink-0 w-14 px-1 py-0.5 text-neutral-500 text-right">
                      {formatLineNum(entry.lineStart, entry.lineEnd)}
                    </span>

                    {/* Severity */}
                    <span className={`flex-shrink-0 w-12 px-1 py-0.5 font-semibold ${severityColor}`}>
                      {entry.severity || ""}
                    </span>

                    {/* Timestamp */}
                    {entry.timestamp && (
                      <span className="flex-shrink-0 px-1 py-0.5 text-neutral-500">
                        {entry.timestamp.length > 24 ? entry.timestamp.slice(0, 24) : entry.timestamp}
                      </span>
                    )}

                    {/* Log content */}
                    <div className="flex-1 min-w-0 px-1 py-0.5 text-neutral-300">
                      {isMultiLine ? (
                        <div className="whitespace-pre-wrap break-all">
                          {entry.text.length > 1000 ? entry.text.slice(0, 1000) + "..." : entry.text}
                        </div>
                      ) : (
                        <span className="break-all">
                          {entry.text.length > 500 ? entry.text.slice(0, 500) + "..." : entry.text}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {hasMore && (
                <div className="flex items-center justify-center gap-3 py-2 bg-neutral-800">
                  <span className="text-neutral-500">
                    {displayedEntries.length.toLocaleString()} / {filteredEntries.length.toLocaleString()}
                  </span>
                  <button
                    onClick={handleShowMore}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    +100 more
                  </button>
                  <button
                    onClick={handleShowAll}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Show all
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6">
              <p className="text-neutral-500">No entries match filters</p>
              <button
                onClick={() => {
                  setSeverityFilter("ALL");
                  setSearchQuery("");
                }}
                className="mt-2 text-blue-400 hover:text-blue-300"
              >
                Clear filters
              </button>
            </div>
          )
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-neutral-500">
            <svg
              className="h-10 w-10 text-neutral-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-2">No log file loaded</p>
            <p className="mt-1 text-neutral-600">Upload a file to view logs</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default Viewer;
