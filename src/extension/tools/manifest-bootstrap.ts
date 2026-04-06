/**
 * manifest_bootstrap tool — Insert work items and edges during bootstrap.
 */

import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import type { Database } from "better-sqlite3";
import { hasSchema } from "../../core/db.ts";

export const name = "manifest_bootstrap";
export const label = "Manifest Bootstrap";
export const description =
  "Insert work items and dependency edges into the manifest database during bootstrap.";
export const promptSnippet =
  "Insert work items and edges into the manifest during bootstrap";
export const promptGuidelines = [
  "Use the manifest-bootstrap skill for the full workflow. This tool handles the database insertion step.",
];

const WorkItemInput = Type.Object({
  id: Type.String({ description: "Work item ID (e.g. 'sr#586', 'phase:core')" }),
  name: Type.String({ description: "Human-readable name" }),
  kind: StringEnum(["issue", "capability", "phase", "track"] as const),
  state: Type.Optional(StringEnum(["planned", "in_progress", "done", "deferred", "cancelled"] as const)),
  repo: Type.Optional(Type.String()),
  issue_number: Type.Optional(Type.Number()),
  issue_url: Type.Optional(Type.String()),
  scope_hint: Type.Optional(Type.String()),
  predicted_files: Type.Optional(Type.Array(Type.String())),
  meta: Type.Optional(Type.Any()),
});

const EdgeInput = Type.Object({
  from_id: Type.String(),
  rel: StringEnum(["depends_on", "is_part_of", "implemented_by"] as const),
  to_id: Type.String(),
  confidence: Type.Optional(StringEnum(["certain", "inferred", "ambiguous"] as const)),
});

export const parameters = Type.Object({
  work_items: Type.Optional(Type.Array(WorkItemInput, { description: "Work items to insert (ON CONFLICT DO NOTHING)" })),
  edges: Type.Optional(Type.Array(EdgeInput, { description: "Dependency/hierarchy edges to insert" })),
});

export function execute(
  db: Database,
  params: {
    work_items?: Array<{
      id: string; name: string; kind: string; state?: string; repo?: string;
      issue_number?: number; issue_url?: string; scope_hint?: string;
      predicted_files?: string[]; meta?: unknown;
    }>;
    edges?: Array<{ from_id: string; rel: string; to_id: string; confidence?: string }>;
  }
): { content: { type: "text"; text: string }[]; details: Record<string, unknown> } {
  if (!hasSchema(db)) {
    throw new Error("Manifest schema not found. Try /manifest-reconnect to reinitialize.");
  }

  const itemsBefore = (db.prepare("SELECT count(*) AS count FROM work_items").get() as { count: number }).count;
  const edgesBefore = (db.prepare("SELECT count(*) AS count FROM edges").get() as { count: number }).count;

  const insertItem = db.prepare(
    `INSERT INTO work_items (id, name, kind, state, repo, issue_number, issue_url, scope_hint, predicted_files, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`
  );

  const insertEdge = db.prepare(
    `INSERT INTO edges (from_id, rel, to_id, confidence)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (from_id, rel, to_id) DO NOTHING`
  );

  if (params.work_items) {
    const insertMany = db.transaction(() => {
      for (const item of params.work_items!) {
        insertItem.run(
          item.id, item.name, item.kind, item.state ?? "planned",
          item.repo ?? null, item.issue_number ?? null, item.issue_url ?? null,
          item.scope_hint ?? null, JSON.stringify(item.predicted_files ?? []),
          item.meta ? JSON.stringify(item.meta) : "{}"
        );
      }
    });
    insertMany();
  }

  if (params.edges) {
    const insertMany = db.transaction(() => {
      for (const edge of params.edges!) {
        insertEdge.run(edge.from_id, edge.rel, edge.to_id, edge.confidence ?? "certain");
      }
    });
    insertMany();
  }

  const totalItems = (db.prepare("SELECT count(*) AS count FROM work_items").get() as { count: number }).count;
  const totalEdges = (db.prepare("SELECT count(*) AS count FROM edges").get() as { count: number }).count;
  const itemsInserted = totalItems - itemsBefore;
  const edgesInserted = totalEdges - edgesBefore;

  return {
    content: [{ type: "text", text: [
      "**Bootstrap insert complete**\n",
      `- Items inserted: ${itemsInserted}${params.work_items ? ` (of ${params.work_items.length} provided)` : ""}`,
      `- Edges inserted: ${edgesInserted}${params.edges ? ` (of ${params.edges.length} provided)` : ""}`,
      `- Total items in manifest: ${totalItems}`,
      `- Total edges in manifest: ${totalEdges}`,
    ].join("\n") }],
    details: { itemsInserted, edgesInserted, totalItems, totalEdges },
  };
}
