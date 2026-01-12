import { NextRequest } from "next/server";
import { LogEntry } from "../../../lib/types";

type ChatRequest = {
  apiKey: string;
  question: string;
  entries: LogEntry[];
};

const SYSTEM_PROMPT = `You are a log analysis assistant. Your job is to help software engineers understand and debug their logs.

IMPORTANT RULES:
1. Answer ONLY based on the provided log entries. Do not make up information or use external knowledge about what might have happened.
2. When referencing specific entries, cite the line numbers (e.g., "At line 42..." or "Lines 100-105 show...").
3. If the provided logs don't contain enough information to answer the question, say so explicitly and suggest what the user should look for.
4. Be concise and technical. Engineers want actionable insights.
5. If you see patterns (repeated errors, timing issues, cascading failures), point them out.`;

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { apiKey, question, entries } = body;

    // Validate request
    if (!apiKey || typeof apiKey !== "string") {
      return Response.json({ error: "API key is required" }, { status: 400 });
    }
    if (!question || typeof question !== "string") {
      return Response.json({ error: "Question is required" }, { status: 400 });
    }
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return Response.json({ error: "At least one log entry is required" }, { status: 400 });
    }

    // Format log entries for the prompt
    const formattedEntries = entries
      .map((entry) => {
        const lineInfo = entry.lineEnd !== entry.lineStart
          ? `[Lines ${entry.lineStart}-${entry.lineEnd}]`
          : `[Line ${entry.lineStart}]`;
        const severity = entry.severity ? `[${entry.severity}]` : "";
        const timestamp = entry.timestamp ? `[${entry.timestamp}]` : "";
        return `${lineInfo} ${severity} ${timestamp}\n${entry.text}`;
      })
      .join("\n\n---\n\n");

    const userMessage = `Here are the selected log entries:\n\n${formattedEntries}\n\n---\n\nQuestion: ${question}`;

    // Call Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Anthropic API error: ${response.status}`;
      return Response.json({ error: errorMessage }, { status: response.status });
    }

    // Stream the response back to the client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);

                  // Handle content_block_delta events
                  if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                    controller.enqueue(encoder.encode(parsed.delta.text));
                  }

                  // Handle error events
                  if (parsed.type === "error") {
                    controller.enqueue(encoder.encode(`\n\nError: ${parsed.error?.message || "Unknown error"}`));
                  }
                } catch {
                  // Skip non-JSON lines
                }
              }
            }
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`\n\nStream error: ${err instanceof Error ? err.message : "Unknown error"}`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
