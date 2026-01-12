# Chatlog

A privacy-focused web app that lets software engineers upload log files and chat with their logs using AI. Got an idea for an improvement? feel free to create a PR 😉


[Test it out here](https://chatlog-six.vercel.app)


Also see below on how to test a deploy and test a local version on your computer, in case you're not comfy with you logs leaving your server

## Key Features

- **Local-first processing** - Logs are parsed entirely in your browser. The full log file never leaves your device.
- **BYOK (Bring Your Own Key)** - Use your own Anthropic API key. Keys are stored in browser session only.
- **Terminal-style viewer** - Fast, compact log viewer with severity filtering and search.
- **AI-powered analysis** - Ask natural language questions about selected log entries.
- **Streaming responses** - Real-time AI responses as they're generated.

## Privacy & Security

Chatlog is designed with privacy in mind:

| What | Where it stays |
|------|----------------|
| Your log file | Browser only (never uploaded) |
| Parsed log entries | Browser memory only |
| Your API key | Browser session storage only |
| Selected entries for chat | Sent to server, proxied to Anthropic, not stored |

**Only the specific log entries you select** are sent to the server when you ask a question. The server acts as a transparent proxy to Anthropic's API and does not log or store any data.

## Usage

### Option 1: Hosted Version

Visit the hosted version (coming soon) and:

1. Upload a log file (drag & drop or click)
2. Enter your Anthropic API key
3. Select log entries you want to analyze
4. Ask questions about the selected entries

### Option 2: Self-Hosted (Recommended for sensitive logs)

If you're working with sensitive logs and don't want your API key or log data to pass through any third-party server, self-host the app:

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/chatlog.git
cd chatlog

# Install dependencies
npm install

# Build and run
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Self-hosting benefits:**
- Your API key goes directly from your machine to Anthropic
- Selected log entries never leave your local network
- Full control over the server environment
- Can run entirely offline (except for AI chat which needs Anthropic API)

### Docker (Optional)

```bash
# Build the image
docker build -t chatlog .

# Run the container
docker run -p 3000:3000 chatlog
```

## Development

```bash
# Install dependencies
npm install

# Run development server (requires Node.js 20 LTS recommended)
npm run dev

# Run production build locally
npm run build && npm run start

# Type check
npm run lint
```

## How It Works

1. **Upload** - You drop a log file (up to 30MB). A Web Worker parses it in the background without freezing the UI.

2. **View** - Parsed entries are displayed in a terminal-style viewer. Filter by severity (ERROR, WARN, INFO, DEBUG, TRACE) or search by text.

3. **Select** - Check the entries you want to analyze. Token count is estimated to stay within limits.

4. **Chat** - Ask questions like:
   - "Why did this crash?"
   - "What's the root cause of these errors?"
   - "Are these warnings related?"
   - "Summarize what happened"

5. **AI Response** - The selected entries + your question are sent to Anthropic's Claude. The AI responds based only on the provided log context.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: Anthropic Claude API
- **Parsing**: Web Workers for non-blocking file processing

## Supported Log Formats

Chatlog auto-detects log entries by looking for:
- Timestamps (ISO 8601, common datetime formats)
- Severity levels (ERROR, WARN, INFO, DEBUG, TRACE)
- Multi-line entries (stack traces, JSON blocks)

Works with most application logs including:
- Application server logs
- Docker/container logs
- System logs
- Custom application logs

## Limitations

- Maximum file size: 30MB
- Maximum tokens per chat: ~16K tokens (~400 log entries)
- Requires Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))

## License

MIT
