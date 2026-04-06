/**
 * manifest_update tool — State transitions on work items.
 */

import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import type { Database } from "better-sqlite3";
import { queryFrontier } from "../../core/planner.ts";

export const name = "manifest_update";
export const label = "Manifest Update";
export const description =
  "Update a work item's state (done, in_progress, planned, deferred, cancelled) and optionally set branch, archive_path, or actual_files.";
export const promptSnippet =
  "Transition a manifest work item's state (done, in_progress, etc.)";

export const parameters = Type.Object({
  id: Type.String({ description: "Work item ID (e.g. 'sr#586', 'm#1')" }),
  state: StringEnum(["planned", "in_progress", "done", "deferred", "cancelled"] as const, { description: "New state" }),
  branch: Type.Optional(Type.String({ description: "Branch name" })),
  archive_path: Type.Optional(Type.String({ description: "Archive path" })),
  actual_files: Type.Optional(Type.Array(Type.String(), { description: "Actual files modified" })),
});

export function execute(
  db: Database,
  params: { id: string; state: string; branch?: string; archive_path?: string; actual_files?: string[] }
): { content: { type: "text"; text: string }[]; details: Record<string, unknown> } {
  const existing = db.prepare("SELECT id, state, name FROM work_items WHERE id = ?").get(params.id) as
    { id: string; state: string; name: string } | undefined;

  if (!existing) throw new Error(`Work item '${params.id}' not found.`);

  const oldState = existing.state;

  if (oldState === params.state && !params.branch && !params.archive_path && !params.actual_files) {
    return {
      content: [{ type: "text", text: `'${params.id}' is already ${params.state}. No changes made.` }],
      details: { id: params.id, state: params.state, changed: false },
    };
  }

  // Build dynamic UPDATE
  const sets: string[] = ["state = ?", "updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"];
  const values: unknown[] = [params.state];

  if (params.branch !== undefined) { sets.push("branch = ?"); values.push(params.branch); }
  if (params.archive_path !== undefined) { sets.push("archive_path = ?"); values.push(params.archive_path); }
  if (params.actual_files !== undefined) { sets.push("actual_files = ?"); values.push(JSON.stringify(params.actual_files)); }

  values.push(params.id);
  db.prepare(`UPDATE work_items SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  const lines = [
    `**${params.id}**: ${existing.name}`,
    `State: ${oldState} → **${params.state}**`,
  ];
  if (params.branch) lines.push(`Branch: ${params.branch}`);
  if (params.archive_path) lines.push(`Archive: ${params.archive_path}`);
  if (params.actual_files) lines.push(`Actual files: ${params.actual_files.length} files recorded`);

  const frontier = queryFrontier(db);
  if (frontier.length > 0) {
    lines.push(`\n**Updated frontier** (${frontier.length} item${frontier.length === 1 ? "" : "s"}):`);
    for (const f of frontier) lines.push(`- ${f.id}: ${f.name}`);
  } else {
    lines.push("\nNo dispatchable items on the frontier.");
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    details: { id: params.id, oldState, newState: params.state, changed: true, frontierCount: frontier.length },
  };
}
