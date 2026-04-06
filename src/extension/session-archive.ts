/**
 * session-archive.ts — Convert pi session entries to readable markdown.
 *
 * Replaces the Python convert-session-log.py from the Claude Code version.
 * Handles pi's JSONL session format (type: "message" with message.role).
 *
 * Pi sessions auto-save and compaction is non-destructive, so this is
 * called at archive time (not pre-compaction like Claude Code).
 */

interface SessionEntry {
  type: string;
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  // message entry
  message?: {
    role: string;
    content: string | ContentBlock[];
    toolCallId?: string;
    toolName?: string;
    details?: unknown;
    isError?: boolean;
    model?: string;
    provider?: string;
    usage?: {
      input?: number;
      output?: number;
      cost?: { total?: number };
    };
    stopReason?: string;
  };
  // compaction entry
  summary?: string;
  firstKeptEntryId?: string;
  tokensBefore?: number;
  // session header
  version?: number;
  cwd?: string;
}

interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  data?: string;
  mimeType?: string;
}

function extractText(content: string | ContentBlock[] | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === "text" && block.text) {
      parts.push(block.text);
    }
  }
  return parts.join("\n\n");
}

function extractToolCalls(content: ContentBlock[]): ContentBlock[] {
  return content.filter((b) => b.type === "toolCall");
}

function truncateLines(text: string, maxLines = 100): string {
  const lines = text.split("\n");
  if (lines.length > maxLines) {
    return (
      lines.slice(0, maxLines).join("\n") +
      `\n\n*[truncated — ${lines.length - maxLines} more lines]*`
    );
  }
  return text;
}

function formatToolCall(tc: ContentBlock): string {
  const name = tc.name || "unknown";
  const args = tc.arguments
    ? truncateLines(JSON.stringify(tc.arguments, null, 2), 50)
    : "{}";
  return `\n<details><summary>Tool: ${name}</summary>\n\n\`\`\`json\n${args}\n\`\`\`\n</details>\n`;
}

/**
 * Convert an array of pi session entries to markdown.
 */
export function convertSessionToMarkdown(
  entries: SessionEntry[],
  metadata?: {
    branch?: string;
    codeSha?: string;
    sessionId?: string;
    sessionFile?: string;
  }
): string {
  const out: string[] = [];

  // Header
  out.push("# Session Log\n");
  out.push("## Metadata\n");
  out.push("| Field | Value |");
  out.push("|-------|-------|");
  if (metadata?.sessionId) out.push(`| Session ID | ${metadata.sessionId} |`);
  if (metadata?.sessionFile) out.push(`| Session File | ${metadata.sessionFile} |`);
  if (metadata?.branch) out.push(`| Branch | ${metadata.branch} |`);
  if (metadata?.codeSha) out.push(`| Code SHA | ${metadata.codeSha} |`);

  // Find session header for cwd
  const header = entries.find((e) => e.type === "session");
  if (header?.cwd) out.push(`| Working Dir | ${header.cwd} |`);

  // Timestamp from first message
  const firstMsg = entries.find((e) => e.type === "message");
  if (firstMsg?.timestamp) out.push(`| Started | ${firstMsg.timestamp} |`);

  out.push("");
  out.push("---\n");
  out.push("## Conversation\n");

  for (const entry of entries) {
    if (entry.type === "session") continue; // skip header

    if (entry.type === "message" && entry.message) {
      const msg = entry.message;

      if (msg.role === "user") {
        const text = extractText(msg.content);
        if (!text.trim()) continue;
        out.push("### User\n");
        out.push(truncateLines(text));
        out.push("");
      } else if (msg.role === "assistant") {
        const content = msg.content;
        if (!content) continue;

        const parts: string[] = [];

        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              parts.push(block.text);
            } else if (block.type === "toolCall") {
              parts.push(formatToolCall(block));
            }
            // Skip thinking blocks
          }
        } else {
          parts.push(String(content));
        }

        const text = parts.join("\n\n");
        if (!text.trim()) continue;

        out.push("### Assistant\n");
        out.push(text);

        // Usage info
        if (msg.usage) {
          const u = msg.usage;
          const costStr = u.cost?.total ? ` · $${u.cost.total.toFixed(4)}` : "";
          out.push(
            `\n*[${msg.model || "unknown"} · ${u.input || 0}→${u.output || 0} tokens${costStr}]*`
          );
        }
        out.push("");
      } else if (msg.role === "toolResult") {
        const text = extractText(msg.content);
        if (!text.trim()) continue;
        const label = msg.toolName || "tool";
        const errorTag = msg.isError ? " ❌" : "";
        out.push(`<details><summary>Result: ${label}${errorTag}</summary>\n`);
        out.push("```");
        out.push(truncateLines(text, 80));
        out.push("```\n");
        out.push("</details>\n");
      }
      // Skip bashExecution, custom, branchSummary etc for now
    }

    if (entry.type === "compaction" && entry.summary) {
      out.push("### Compaction Summary\n");
      out.push(entry.summary);
      out.push(
        `\n*[${entry.tokensBefore || 0} tokens summarized]*\n`
      );
    }
  }

  out.push("---\n");
  out.push("*Session log converted by Escapement for Pi*");

  return out.join("\n") + "\n";
}

/**
 * Read a JSONL session file and convert to markdown.
 */
export function convertSessionFile(
  jsonlContent: string,
  metadata?: Parameters<typeof convertSessionToMarkdown>[1]
): string {
  const entries: SessionEntry[] = [];
  for (const line of jsonlContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // skip malformed lines
    }
  }
  return convertSessionToMarkdown(entries, metadata);
}
