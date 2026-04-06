/**
 * manifest_status tool — Show overall manifest progress.
 */

import { Type } from "@sinclair/typebox";
import type { Database } from "better-sqlite3";
import { loadQuery } from "../../core/db.ts";

export const name = "manifest_status";
export const label = "Manifest Status";
export const description =
  "Show overall manifest progress — state counts and hierarchical phase/track completion rollup.";
export const promptSnippet =
  "Display manifest progress with phase/track completion percentages";

export const parameters = Type.Object({});

export function execute(
  db: Database,
  _params: Record<string, never>
): { content: { type: "text"; text: string }[]; details: Record<string, unknown> } {
  const summary = db.prepare(
    "SELECT state, count(*) AS count FROM work_items GROUP BY state ORDER BY state"
  ).all() as { state: string; count: number }[];

  let total = 0;
  const byState: Record<string, number> = {};
  for (const row of summary) {
    byState[row.state] = row.count;
    total += row.count;
  }

  const lines = ["**Manifest Status**\n", `Total items: ${total}\n`];
  for (const s of ["planned", "in_progress", "done", "deferred", "cancelled"]) {
    if (byState[s]) lines.push(`- **${s}**: ${byState[s]}`);
  }

  const progressSql = loadQuery("progress");
  const rollupRows = db.prepare(progressSql).all() as {
    name: string; total_items: number; done_items: number;
  }[];

  const rollup: { name: string; total: number; done: number; pct: number }[] = [];

  if (rollupRows.length > 0) {
    lines.push("\n**Phase / Track Progress**\n");
    lines.push("| Name | Done | Total | Progress |");
    lines.push("|------|------|-------|----------|");
    for (const row of rollupRows) {
      const pct = row.total_items === 0 ? 0 : Math.round((row.done_items / row.total_items) * 100);
      rollup.push({ name: row.name, total: row.total_items, done: row.done_items, pct });
      lines.push(`| ${row.name} | ${row.done_items} | ${row.total_items} | ${pct}% |`);
    }
  }

  return { content: [{ type: "text", text: lines.join("\n") }], details: { byState, total, rollup } };
}
