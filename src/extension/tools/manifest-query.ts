/**
 * manifest_query tool — Execute raw SQL against the manifest database.
 */

import { Type } from "@sinclair/typebox";
import type { Database } from "better-sqlite3";

export const name = "manifest_query";
export const label = "Manifest Query";
export const description =
  "Execute a raw SQL query against the manifest SQLite database.";
export const promptSnippet =
  "Run raw SQL against the manifest SQLite database";
export const promptGuidelines = [
  "Use manifest_query only when other manifest tools don't cover your need.",
];

export const parameters = Type.Object({
  sql: Type.String({ description: "SQL query to execute" }),
});

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

export function execute(
  db: Database,
  params: { sql: string }
): { content: { type: "text"; text: string }[]; details: Record<string, unknown> } {
  const sql = params.sql.trim();

  // Detect if it's a write statement
  if (/^(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sql)) {
    const info = db.prepare(sql).run();
    return {
      content: [{ type: "text", text: `Statement executed. Rows affected: ${info.changes}` }],
      details: { changes: info.changes },
    };
  }

  const rows = db.prepare(sql).all() as Record<string, unknown>[];

  if (rows.length === 0) {
    return { content: [{ type: "text", text: "(0 rows)" }], details: { rows: [], rowCount: 0 } };
  }

  const cols = Object.keys(rows[0]);
  const widths = cols.map((c) =>
    Math.max(c.length, ...rows.map((r) => formatValue(r[c]).length))
  );

  const lines = [
    cols.map((c, i) => pad(c, widths[i])).join(" | "),
    widths.map((w) => "─".repeat(w)).join("─┼─"),
    ...rows.map((r) => cols.map((c, i) => pad(formatValue(r[c]), widths[i])).join(" | ")),
    `\n(${rows.length} row${rows.length === 1 ? "" : "s"})`,
  ];

  return { content: [{ type: "text", text: lines.join("\n") }], details: { rows, rowCount: rows.length } };
}
