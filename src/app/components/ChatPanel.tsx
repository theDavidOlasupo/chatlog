"use client";

import { FormEvent, useEffect, useState } from "react";
import { LogEntry } from "../../lib/types";

type Props = {
  entries: LogEntry[];
  selectedEntries: LogEntry[];
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

const MAX_TOKENS = 16000; // ~16K tokens
const CHARS_PER_TOKEN = 4; // Rough estimate

const ChatPanel = ({ entries, selectedEntries }: Props) => {
  const [apiKey, setApiKey] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasData = entries.length > 0;
  const hasSelection = selectedEntries.length > 0;

  // Load API key from session storage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("anthropic_api_key");
    if (stored) setApiKey(stored);
  }, []);

  // Save API key to session storage
  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    if (key) {
      sessionStorage.setItem("anthropic_api_key", key);
    } else {
      sessionStorage.removeItem("anthropic_api_key");
    }
  };

  // Estimate token count for selected entries
  const selectedText = selectedEntries.map((e) => e.text).join("\n");
  const estimatedTokens = Math.ceil(selectedText.length / CHARS_PER_TOKEN);
  const isOverLimit = estimatedTokens > MAX_TOKENS;

  const canSend = hasSelection && apiKey.trim() && question.trim() && !isLoading && !isOverLimit;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;

    const userMessage = question.trim();
    setQuestion("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          question: userMessage,
          entries: selectedEntries,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantMessage = "";

      // Add empty assistant message that we'll update
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantMessage += chunk;

        // Update the last message with accumulated content
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantMessage };
          return updated;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      // Remove the empty assistant message if there was an error
      setMessages((prev) => {
        if (prev.length > 0 && prev[prev.length - 1].role === "assistant" && !prev[prev.length - 1].content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex h-full min-h-[500px] flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-neutral-900">Chat</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Ask questions about your selected log entries
      </p>

      {/* API Key input */}
      <div className="mt-4">
        <label className="block text-xs font-medium text-neutral-700">
          Anthropic API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder="sk-ant-..."
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm placeholder-neutral-400"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Your key is stored in browser session only.{" "}
          <a href="#" className="text-blue-600 hover:underline">
            Privacy info
          </a>
        </p>
      </div>

      {/* Selection info */}
      {hasData && (
        <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-xs text-neutral-600">
            {hasSelection ? (
              <>
                <span className="font-medium text-neutral-900">
                  {selectedEntries.length} entries selected
                </span>
                <span className="ml-2">
                  (~{estimatedTokens.toLocaleString()} tokens)
                </span>
                {isOverLimit && (
                  <span className="ml-2 font-medium text-red-600">
                    Exceeds {MAX_TOKENS.toLocaleString()} token limit
                  </span>
                )}
              </>
            ) : (
              "Select entries in the Viewer to analyze"
            )}
          </p>
        </div>
      )}

      {/* Messages area */}
      <div className="mt-4 flex flex-1 flex-col overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        {messages.length > 0 ? (
          <div className="flex flex-col gap-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-3 ${
                  msg.role === "user"
                    ? "bg-blue-100 text-blue-900"
                    : "bg-white border border-neutral-200 text-neutral-800"
                }`}
              >
                <p className="text-xs font-medium mb-1 opacity-60">
                  {msg.role === "user" ? "You" : "Assistant"}
                </p>
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.content === "" && (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Thinking...
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center">
            <svg
              className="h-12 w-12 text-neutral-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="mt-3 text-sm text-neutral-500">No messages yet</p>
            <p className="mt-1 text-xs text-neutral-400">
              {hasData
                ? hasSelection
                  ? "Ask a question about the selected entries"
                  : "Select entries in the Viewer to get started"
                : "Upload logs to start chatting"}
            </p>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              !hasData
                ? "Upload a log file first..."
                : !hasSelection
                ? "Select entries to analyze..."
                : !apiKey
                ? "Enter your API key above..."
                : "Ask a question about the selected entries..."
            }
            disabled={!hasData || !hasSelection || !apiKey.trim()}
            className={`flex-1 rounded-lg border px-4 py-2.5 text-sm ${
              hasSelection && apiKey
                ? "border-neutral-300 bg-white text-neutral-900 placeholder-neutral-500"
                : "border-neutral-200 bg-neutral-50 text-neutral-400 placeholder-neutral-400"
            }`}
          />
          <button
            type="submit"
            disabled={!canSend}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
              canSend
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-neutral-200 text-neutral-400"
            }`}
          >
            {isLoading ? "..." : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
};

export default ChatPanel;
