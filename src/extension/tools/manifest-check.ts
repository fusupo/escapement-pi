/**
 * manifest_check tool — Run manifest health checks.
 */

import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import type { Database } from "better-sqlite3";
import { loadQuery, parseJsonArray } from "../../core/db.ts";

export const name = "manifest_check";
export const label = "Manifest Check";
export const description =
  "Run manifest health checks: reconcile predictions vs actuals, detect superseded items, re-run overlap analysis, analyze drift patterns, or list issue numbers.";
export const promptSnippet =
  "Run manifest health checks (reconcile, superseded, overlap, drift)";

export const parameters = Type.Object({
  check: StringEnum(["all", "reconcile", "superseded", "overlap", "drift", "new-issues"] as const, {
    description: "Which check to run. 'all' runs reconcile + superseded + overlap + drift.",
  }),
});

function checkSuperseded(db: Database): string {
  const rows = db.prepare(loadQuery("superseded")).all() as {
    older_id: string; older_name: string; newer_id: string; newer_name: string; shared_files: string;
  }[];
  if (rows.length === 0) return "**Supersession**: No superseded in_progress items detected.";

  const lines = [`**Supersession**: ${rows.length} potential supersession(s)\n`,
    "| Older Item | Newer Item | Shared Files |", "|------------|------------|--------------|"];
  for (const r of rows) {
    const files = parseJsonArray(r.shared_files);
    lines.push(`| ${r.older_id} (${r.older_name}) | ${r.newer_id} (${r.newer_name}) | ${files.length > 0 ? files.join(", ") : "(scope match)"} |`);
  }
  return lines.join("\n");
}

function checkReconcile(db: Database): string {
  const rows = db.prepare(loadQuery("reconcile")).all() as {
    id: string; name: string; predicted_files: string; actual_files: string;
    hits: string; misses: string; false_positives: string;
  }[];
  if (rows.length === 0) return "**Reconciliation**: No completed items with both predicted and actual files.";

  const lines = [`**Reconciliation**: ${rows.length} item(s)\n`];
  let totalHits = 0, totalMisses = 0, totalFP = 0;

  for (const r of rows) {
    const h = parseJsonArray(r.hits), m = parseJsonArray(r.misses), fp = parseJsonArray(r.false_positives);
    const denom = h.length + m.length + fp.length;
    const acc = denom === 0 ? 100 : Math.round((h.length / denom) * 100);
    totalHits += h.length; totalMisses += m.length; totalFP += fp.length;

    lines.push(`- **${r.id}**: ${r.name} — ${acc}% accuracy (${h.length} hits, ${m.length} misses, ${fp.length} false pos)`);
    if (m.length > 0) lines.push(`  - Missed: ${m.join(", ")}`);
    if (fp.length > 0) lines.push(`  - False pos: ${fp.join(", ")}`);

    db.prepare(
      `UPDATE work_items SET meta = json_set(meta, '$.reconciliation', json(?)), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`
    ).run(JSON.stringify({ hits: h, misses: m, false_positives: fp, accuracy: denom === 0 ? 1.0 : h.length / denom, checked_at: new Date().toISOString() }), r.id);
  }

  const totalDenom = totalHits + totalMisses + totalFP;
  const overall = totalDenom === 0 ? 100 : Math.round((totalHits / totalDenom) * 100);
  lines.push(`\nOverall: ${overall}% accuracy (${totalHits} hits, ${totalMisses} misses, ${totalFP} false pos)`);
  return lines.join("\n");
}

function checkOverlap(db: Database): string {
  const rows = db.prepare(loadQuery("overlap")).all() as { node_a: string; node_b: string; shared_files: string }[];
  if (rows.length === 0) return "**Overlap**: No overlapping file sets among frontier items.";

  const lines = [`**Overlap**: ${rows.length} pair(s) with shared files\n`,
    "| Item A | Item B | Shared Files |", "|--------|--------|--------------|"];
  for (const r of rows) {
    const files = parseJsonArray(r.shared_files);
    lines.push(`| ${r.node_a} | ${r.node_b} | ${files.join(", ")} |`);
  }
  return lines.join("\n");
}

function checkDrift(db: Database): string {
  const rows = db.prepare(`
    SELECT id, json_extract(meta, '$.reconciliation.misses') AS misses
    FROM work_items
    WHERE json_extract(meta, '$.reconciliation.misses') IS NOT NULL
      AND json_array_length(json_extract(meta, '$.reconciliation.misses')) > 0
  `).all() as { id: string; misses: string }[];

  if (rows.length === 0) return "**Drift**: No reconciliation data available. Run 'reconcile' first.";

  const fileMissCounts: Record<string, string[]> = {};
  for (const row of rows) {
    for (const file of parseJsonArray(row.misses)) {
      if (!fileMissCounts[file]) fileMissCounts[file] = [];
      fileMissCounts[file].push(row.id);
    }
  }

  const driftFiles = Object.entries(fileMissCounts).filter(([, ids]) => ids.length >= 2).sort((a, b) => b[1].length - a[1].length);
  if (driftFiles.length === 0) return `**Drift**: No repeated drift patterns. Data from ${rows.length} item(s).`;

  const lines = [`**Drift**: ${driftFiles.length} frequently missed file(s)\n`];
  for (const [file, ids] of driftFiles) lines.push(`- \`${file}\`: missed in ${ids.length} items (${ids.join(", ")})`);
  return lines.join("\n");
}

function checkNewIssues(db: Database): string {
  const rows = db.prepare(
    "SELECT repo, issue_number FROM work_items WHERE issue_number IS NOT NULL AND repo IS NOT NULL ORDER BY repo, issue_number"
  ).all() as { repo: string; issue_number: number }[];

  if (rows.length === 0) return "**Issues**: No issues in manifest.";

  const byRepo: Record<string, number[]> = {};
  for (const r of rows) { if (!byRepo[r.repo]) byRepo[r.repo] = []; byRepo[r.repo].push(r.issue_number); }

  const lines = ["**Manifest Issue Numbers**\n"];
  for (const [repo, numbers] of Object.entries(byRepo)) lines.push(`- **${repo}**: ${numbers.join(", ")}`);
  lines.push(`\nTotal: ${rows.length} issue(s) across ${Object.keys(byRepo).length} repo(s)`);
  return lines.join("\n");
}

export function execute(
  db: Database,
  params: { check: string }
): { content: { type: "text"; text: string }[]; details: Record<string, unknown> } {
  const sections: string[] = [];
  if (params.check === "all" || params.check === "superseded") sections.push(checkSuperseded(db));
  if (params.check === "all" || params.check === "reconcile") sections.push(checkReconcile(db));
  if (params.check === "all" || params.check === "overlap") sections.push(checkOverlap(db));
  if (params.check === "all" || params.check === "drift") sections.push(checkDrift(db));
  if (params.check === "new-issues") sections.push(checkNewIssues(db));

  return { content: [{ type: "text", text: sections.join("\n\n---\n\n") }], details: { check: params.check } };
}
