# Chatlog – Final Design Doc (v1)
Date: 2026-01-02  
Repo: Next.js (TypeScript) single repo (App Router)

---

## 1) Summary

**Chatlog** is a web application that lets software engineers upload log files and **chat with their logs**.

Core principle:
> **Local-first log analysis, LLM-assisted reasoning**

- Logs are parsed, searched, counted, and filtered **locally in the browser**
- The LLM is used **only** for reasoning, summarization, and explanation
- Only **selected, redacted log entries** are sent to the server and LLM
- The entire log file is **never sent** to the server in v1

---

## 2) Goals

### Primary goals
- Upload large log files without freezing the UI
- Parse the logs (error, warning and info) and have a drop down where users can select what type of logs to view
- Ask natural-language questions about selected logs
- Maintain privacy by minimizing data sent off-device
- Support BYOK (Bring Your Own LLM API key)

### Secondary goals
- Clear trust model: show exactly what data leaves the browser
- Cheap, fast, deterministic behavior for common queries
- Easy future path to browser extension

---

## 3) Non-goals (v1)

- Live log tailing
- Multi-file correlation
- User accounts, teams, billing
- Full compliance guarantees (SOC2, HIPAA, etc.)
- Embeddings-based retrieval (can be added later)

---

## 4) UX Overview

### Layout (single page)
Four logical panels:

1) **Upload + Viewer**
- Drag/drop log file, restrict file size to 30mb
- Show file name, size, detected patterns like number of errors in logs
- Scrollable viewer with line numbers
- Highlight ERROR/WARN/INFO
- Local search (Ctrl+F style)

2) **Chat**
- Chat input + streaming responses
- User can select one or multiple log lines (using checkbox control) to send to LLM for questioning

3) **Privacy & Key**
- BYOK modal (session-only by default)

---

## 5) High-level Architecture

### Browser (client)
Responsible for:
- Streaming file read
- Parsing and grouping log entries (multi-line aware)
- Token limit enforcement: Maximum 16K tokens (~400 log lines) per LLM request. If user selects more entries, show a warning and ask them to narrow selection.
- Redaction

### Server (Next.js API routes)
Responsible for:
- Thin proxy to LLM providers (use Anthropic)
- Payload validation and limits
- Rate limiting
- Streaming LLM responses
- No persistence, no database, no log storage

---

## 6) Data Flow

### 6.1 Upload → Parse → Index (once)
1. User uploads file
2. File read incrementally in a Web Worker
3. Lines grouped into log entries (multi-line aware)

No network calls.

---

### 6.2 Chat Flow
1. User selects log entries via checkboxes in the Viewer
2. User types question in ChatPanel
3. Browser sends question + selected entries to `/api/chat`
4. Server proxies to Anthropic API, streams response back
5. ChatPanel displays streaming response

Note: Redaction of sensitive data is handled in Milestone 5.

**Entire log never leaves the browser.**

---

## 7) LLM Router (critical)

### 7.1 LLM-required intents
- Chatlog sends every question to the LLM.
Require reasoning or synthesis:
- “Why did the service crash?”
- “What’s the most likely root cause?”
- “Summarize what happened”
- “Are these errors related?”

---

## 8) Parsing Strategy (“Any logs”)

### 8.1 Log entry detection
A new entry starts if a line:
- starts with a timestamp (best-effort)
- starts with severity (ERROR/WARN/INFO/DEBUG/TRACE)
- Log sample is below
`2026-01-03T06:29:46.882261Z TRACE [AuthService] Retrying operation id=4415 duration=1414ms`
`2026-01-03T06:26:48.642261Z TRACE [EmailService] Operation completed successfully id=7293 duration=1009ms`

---

## 11) Redaction (default ON)

### 11.1 Redaction rules

Before sending selected entries to the server, mask:
- Authorization headers
- JWT-like tokens
- API keys
- Email addresses
- Long hex or base64 strings
- Passwords

### 11.2 Redaction behavior
- Redaction preview should be shown via a toggle button (to reduce UI clutter) before the LLM call
- User may disable redaction with an explicit warning

---

## 12) LLM Prompting Rules

### 12.1 Chat
- Answer **only** from provided log entries
- Cite line ranges when referencing specific entries
- No facts outside the provided entries
- If insufficient data:
  - Say so explicitly
  - Suggest what the user should search for

---

## 13) API Routes (Next.js)

### POST `/api/chat`
- Streaming response
- Optional final citation payload

---

## 14) Security & Privacy Guarantees (v1)

- Raw logs are never stored server-side
- Only selected entries are transmitted
- **API key handling:**
  - Key is stored in browser session storage only
  - Key is sent to server only to proxy requests to Anthropic
  - Key exists in server memory only during the request
  - Key is never logged, persisted, or transmitted elsewhere
  - Server code is open source for auditability
- Request body logging is disabled
- Rate limits are enforced

### Privacy Notice (shown in UI)
> "Your API key is sent to our server only to proxy requests to Anthropic.
> It is never logged or stored. The server code is open source."

---

## 15) Project Structure

```
src/
  app/
    page.tsx
    components/
      Uploader.tsx
      Viewer.tsx
      ChatPanel.tsx
      RedactionModal.tsx
  app/api/
    chat/route.ts
  lib/
    redaction/
    types.ts
  workers/
    parse.worker.ts
docs/
  design.md
```
---

## 16) MVP Milestones

### Milestone 1: UI scaffold
- Main page layout with panels:
  - Upload
  - Viewer
  - Chat
- Placeholder components under `src/app/components`

### Milestone 2: Worker plumbing
- Web Worker with streaming parser at `src/workers/parse.worker.ts`
- Uploader wiring:
  - file → worker → progress → done
- Store `entries` in page state
- Parser features (already implemented):
  - Streaming read (no full file in memory)
  - Multi-line aware grouping (stack traces, continuations)
  - Severity and timestamp detection

### Milestone 3: Viewer basics
- Render log entries with line numbers
- Severity highlighting (ERROR=red, WARN=yellow, INFO=blue)
- Filter by severity level (dropdown)
- Simple text search to filter displayed entries
- No LLM calls yet

### Milestone 4: Chat + LLM integration
- Add checkboxes to Viewer for selecting entries
- BYOK input for Anthropic API key (session storage)
- ChatPanel sends question + selected entries to `/api/chat`
- `/api/chat` proxies to Anthropic with streaming response
- Display streaming response in ChatPanel
- Token limit warning if selected entries exceed ~16K tokens
- No redaction yet (handled in M5)

### Milestone 5: Redaction + preview
- Implement redaction in `src/lib/redaction/`:
  - mask auth headers, JWT-like tokens, API keys, emails, long tokens
- Add redaction preview modal but make it hidden by default:
  - show exactly what would be sent to server
- Default redaction ON, allow disabling with warning

### Milestone 6: Conversation continuity
- Support follow-up questions in chat
- Send conversation history (previous messages) with each API call
- Keep selected log entries as context throughout conversation
- Implement sliding window if token limits become an issue
- Allow user to clear chat history and start fresh

## 17) Guiding Principle (do not violate)

> **The browser is the database.**  
> **Handle errors and display message to user, if error occurs during file parsing or API call.**  
> **The LLM is a reasoning layer, not a search engine.**