export type LogEntry = {
  lineStart: number;
  lineEnd: number;
  text: string;
  severity?: string;
  timestamp?: string;
};

export type ParsingStats = {
  bytesProcessed: number;
  totalBytes: number;
  lines: number;
  entries: number;
  durationMs: number;
};

export type RedactionFinding = {
  kind: "authorization" | "jwt" | "apiKey" | "email" | "hex" | "base64";
  count: number;
};
