/**
 * manifest_dispatch tool — Prepare parallel dispatch from a manifest plan.
 */

import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import type { Database } from "better-sqlite3";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { buildDispatchPlan, type PlanNode } from "../../core/planner.ts";

export const name = "manifest_dispatch";
export const label = "Manifest Dispatch";
export const description =
  "Prepare parallel work dispatch from a manifest plan. Creates git worktrees, updates manifest state, and returns subagent parameters.";
export const promptSnippet =
  "Dispatch parallel work: create worktrees, update state, launch agents";
export const promptGuidelines = [
  "After manifest_dispatch returns, use the subagent tool with the returned parameters to launch the parallel agents.",
  "Requires pi-subagents to be installed (pi install npm:pi-subagents).",
];

export const parameters = Type.Object({
  group_index: Type.Optional(Type.Number({ description: "Index of the parallel group to dispatch (0-based). Default: 0." })),
  base_branch: Type.Optional(Type.String({ description: "Base branch for worktrees (default: 'main')" })),
  mode: Type.Optional(StringEnum(["prepare", "prepare-and-launch"] as const, {
    description: "'prepare' creates worktrees and returns subagent params. 'prepare-and-launch' also queues a follow-up message.",
  })),
});

function buildConstraintBlock(node: PlanNode): string {
  const lines = [`Work on: ${node.id} — ${node.name}`];
  if (node.issue_url) lines.push(`Issue: ${node.issue_url}`);
  if (node.files_owned.length > 0) {
    lines.push("\nFiles you own (may modify freely):");
    for (const f of node.files_owned) lines.push(`  - ${f}`);
  }
  if (node.files_shared.length > 0) {
    lines.push("\nShared files (modify only your section):");
    for (const sf of node.files_shared) lines.push(`  - ${sf.path} [${sf.assessment}]: ${sf.notes || "coordinate with other agents"}`);
  }
  if (node.files_forbidden.length > 0) {
    lines.push("\nDo NOT touch these files:");
    for (const f of node.files_forbidden) lines.push(`  - ${f}`);
  }
  return lines.join("\n");
}

export function execute(
  db: Database,
  params: { group_index?: number; base_branch?: string; mode?: string },
  cwd: string,
  pi?: ExtensionAPI
): { content: { type: "text"; text: string }[]; details: Record<string, unknown> } {
  const plan = buildDispatchPlan(db);

  if (plan.parallel_groups.length === 0) {
    return {
      content: [{ type: "text", text: "No parallel groups to dispatch." }],
      details: { plan: plan.summary },
    };
  }

  const groupIdx = params.group_index ?? 0;
  if (groupIdx >= plan.parallel_groups.length) {
    return {
      content: [{ type: "text", text: `Group index ${groupIdx} out of range. Available: 0-${plan.parallel_groups.length - 1}` }],
      details: { groupCount: plan.parallel_groups.length },
    };
  }

  const group = plan.parallel_groups[groupIdx];
  const baseBranch = params.base_branch || "main";

  const subagentTasks = group.nodes.map((node) => ({
    agent: "manifest-worker",
    task: buildConstraintBlock(node),
    cwd: `../worktree-${node.id.replace(/[#:]/g, "-")}`,
  }));

  const worktreeCommands = group.nodes.map((node) => {
    const wtDir = `../worktree-${node.id.replace(/[#:]/g, "-")}`;
    return `git worktree add "${wtDir}" ${baseBranch} && cd "${wtDir}" && git checkout -b ${node.branch}`;
  });

  // Update manifest state
  const updateStmt = db.prepare(
    "UPDATE work_items SET state = 'in_progress', branch = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?"
  );
  for (const node of group.nodes) {
    updateStmt.run(node.branch, node.id);
  }

  const lines = [
    `## Dispatch: Group ${groupIdx + 1} (${group.repo})\n`,
    `**${group.nodes.length} agent(s)** to launch\n`,
    "### Worktree Setup\n", "```bash", ...worktreeCommands, "```\n",
    "### Manifest State\n", `All ${group.nodes.length} items marked \`in_progress\`:\n`,
  ];
  for (const node of group.nodes) lines.push(`- **${node.id}**: ${node.name} → branch \`${node.branch}\``);
  if (group.merge_order) lines.push(`\n**Merge order**: ${group.merge_order.join(" → ")}`);
  lines.push("\n### Subagent Parameters\n", "```json", JSON.stringify({ tasks: subagentTasks }, null, 2), "```");

  if (params.mode === "prepare-and-launch" && pi) {
    pi.sendUserMessage(
      `Launch parallel agents:\n\n${JSON.stringify({ tasks: subagentTasks }, null, 2)}`,
      { deliverAs: "followUp" }
    );
    lines.push("\n✅ Follow-up message queued.");
  }

  lines.push("\n### After Completion\n", "1. Use `manifest-sync` to mark done", "2. Remove worktree: `git worktree remove ../worktree-{id}`");

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    details: { group: groupIdx, repo: group.repo, nodeCount: group.nodes.length, nodes: group.nodes.map((n) => n.id), subagentParams: { tasks: subagentTasks }, worktreeCommands, mergeOrder: group.merge_order },
  };
}
