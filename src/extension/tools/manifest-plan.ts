/**
 * manifest_plan tool — Generate a dispatch plan from the manifest frontier.
 */

import { Type } from "@sinclair/typebox";
import type { Database } from "better-sqlite3";
import { buildDispatchPlan, formatPlan } from "../../core/planner.ts";

export const name = "manifest_plan";
export const label = "Manifest Plan";
export const description =
  "Generate a dispatch plan showing what work can run in parallel, what's blocked, and file ownership constraints.";
export const promptSnippet =
  "Generate a parallel dispatch plan from the manifest frontier";

export const parameters = Type.Object({
  format: Type.Optional(Type.String({ description: "Output format: 'markdown' (default) or 'json'" })),
});

export function execute(
  db: Database,
  params: { format?: string }
): { content: { type: "text"; text: string }[]; details: Record<string, unknown> } {
  const plan = buildDispatchPlan(db);

  if (params.format === "json") {
    return { content: [{ type: "text", text: JSON.stringify(plan, null, 2) }], details: { plan } };
  }

  return { content: [{ type: "text", text: formatPlan(plan) }], details: { plan } };
}
