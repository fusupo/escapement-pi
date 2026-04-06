/**
 * manifest_frontier tool — Query dispatchable work items.
 */

import { Type } from "@sinclair/typebox";
import type { Database } from "better-sqlite3";
import { queryFrontier } from "../../core/planner.ts";

export const name = "manifest_frontier";
export const label = "Manifest Frontier";
export const description =
  "Query the manifest for dispatchable work items — planned items with all dependencies met and no human gate.";
export const promptSnippet =
  "Show dispatchable work items from the manifest dependency graph";

export const parameters = Type.Object({
  repo: Type.Optional(Type.String({ description: "Filter by repo" })),
});

export function execute(
  db: Database,
  params: { repo?: string }
): { content: { type: "text"; text: string }[]; details: Record<string, unknown> } {
  let frontier = queryFrontier(db);

  if (params.repo) {
    frontier = frontier.filter((f) => f.repo === params.repo);
  }

  if (frontier.length === 0) {
    return { content: [{ type: "text", text: "No dispatchable work items." }], details: { frontier: [] } };
  }

  const lines = [
    `**Frontier: ${frontier.length} dispatchable item(s)**\n`,
    "| ID | Kind | Repo | Name | Files |",
    "|-----|------|------|------|-------|",
  ];
  for (const item of frontier) {
    const files = item.predicted_files.length > 0 ? item.predicted_files.length.toString() : "-";
    lines.push(`| ${item.id} | ${item.kind} | ${item.repo ?? "-"} | ${item.name} | ${files} |`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }], details: { frontier } };
}
