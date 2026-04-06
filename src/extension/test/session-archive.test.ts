/**
 * Test the session-to-markdown converter.
 */

import { convertSessionFile, convertSessionToMarkdown } from "../session-archive.ts";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

// Build a mock JSONL session
const mockSession = [
  JSON.stringify({
    type: "session",
    version: 3,
    id: "test-session-id",
    timestamp: "2026-03-31T10:00:00.000Z",
    cwd: "/home/user/project",
  }),
  JSON.stringify({
    type: "message",
    id: "m1",
    parentId: null,
    timestamp: "2026-03-31T10:00:01.000Z",
    message: {
      role: "user",
      content: "What files are in this directory?",
      timestamp: Date.now(),
    },
  }),
  JSON.stringify({
    type: "message",
    id: "m2",
    parentId: "m1",
    timestamp: "2026-03-31T10:00:02.000Z",
    message: {
      role: "assistant",
      content: [
        { type: "text", text: "Let me check the directory contents." },
        {
          type: "toolCall",
          id: "tc1",
          name: "bash",
          arguments: { command: "ls -la" },
        },
      ],
      model: "claude-sonnet-4-5",
      provider: "anthropic",
      usage: { input: 100, output: 50, cost: { total: 0.001 } },
      stopReason: "toolUse",
      timestamp: Date.now(),
    },
  }),
  JSON.stringify({
    type: "message",
    id: "m3",
    parentId: "m2",
    timestamp: "2026-03-31T10:00:03.000Z",
    message: {
      role: "toolResult",
      toolCallId: "tc1",
      toolName: "bash",
      content: [{ type: "text", text: "total 42\ndrwxr-xr-x  5 user user 4096 Mar 31 10:00 .\n-rw-r--r--  1 user user  256 Mar 31 09:00 README.md" }],
      isError: false,
      timestamp: Date.now(),
    },
  }),
  JSON.stringify({
    type: "message",
    id: "m4",
    parentId: "m3",
    timestamp: "2026-03-31T10:00:04.000Z",
    message: {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "The directory has a README and 5 subdirectories." },
        { type: "text", text: "The directory contains a README.md and several subdirectories." },
      ],
      model: "claude-sonnet-4-5",
      provider: "anthropic",
      usage: { input: 200, output: 30, cost: { total: 0.0005 } },
      stopReason: "stop",
      timestamp: Date.now(),
    },
  }),
  JSON.stringify({
    type: "compaction",
    id: "c1",
    parentId: "m4",
    timestamp: "2026-03-31T11:00:00.000Z",
    summary: "User asked about directory contents. Assistant listed files using bash.",
    firstKeptEntryId: "m4",
    tokensBefore: 5000,
  }),
].join("\n");

console.log("Session archive converter tests\n");

// Test convertSessionFile
console.log("1. Convert JSONL to markdown");
const md = convertSessionFile(mockSession, {
  branch: "main",
  codeSha: "abc1234",
  sessionId: "test-session-id",
});

assert(md.includes("# Session Log"), "Has title");
assert(md.includes("test-session-id"), "Has session ID");
assert(md.includes("main"), "Has branch");
assert(md.includes("abc1234"), "Has code SHA");
assert(md.includes("/home/user/project"), "Has working dir from header");

console.log("\n2. User messages");
assert(md.includes("### User"), "Has user section");
assert(md.includes("What files are in this directory?"), "Has user message text");

console.log("\n3. Assistant messages");
assert(md.includes("### Assistant"), "Has assistant section");
assert(md.includes("Let me check the directory contents."), "Has assistant text");
assert(md.includes("Tool: bash"), "Has tool call");
assert(md.includes("ls -la"), "Has tool call args");

console.log("\n4. Tool results");
assert(md.includes("Result: bash"), "Has tool result");
assert(md.includes("README.md"), "Has tool result content");

console.log("\n5. Thinking blocks stripped");
assert(!md.includes("The directory has a README and 5 subdirectories"), "Thinking text NOT in output");
assert(md.includes("The directory contains a README.md"), "Regular text IS in output");

console.log("\n6. Usage info");
assert(md.includes("claude-sonnet-4-5"), "Has model name");
assert(md.includes("tokens"), "Has token info");
assert(md.includes("$0.001"), "Has cost");

console.log("\n7. Compaction summary");
assert(md.includes("### Compaction Summary"), "Has compaction section");
assert(md.includes("User asked about directory contents"), "Has compaction text");
assert(md.includes("5000 tokens summarized"), "Has token count");

console.log("\n8. Footer");
assert(md.includes("Escapement for Pi"), "Has footer attribution");

console.log("\n9. Empty / malformed input");
const emptyMd = convertSessionFile("", {});
assert(emptyMd.includes("# Session Log"), "Empty input still produces header");

const malformedMd = convertSessionFile("not json\n{bad", {});
assert(malformedMd.includes("# Session Log"), "Malformed input still produces header");

console.log("\n✅ All session archive tests passed!\n");
