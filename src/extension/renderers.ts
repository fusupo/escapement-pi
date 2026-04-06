/**
 * renderers.ts — Custom TUI renderers for manifest tools.
 *
 * Provides renderCall/renderResult for compact and expanded views
 * of manifest tool outputs.
 */

import { Text, Container, Spacer } from "@mariozechner/pi-tui";

// ── Shared helpers ───────────────────────────────────────────────────

function pctBar(done: number, total: number, width: number = 20): string {
  if (total === 0) return "░".repeat(width);
  const pct = done / total;
  const filled = Math.round(pct * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

// ── manifest_frontier ────────────────────────────────────────────────

export const frontierRenderCall = (
  args: Record<string, unknown>,
  theme: any,
  _context: any
) => {
  let text = theme.fg("toolTitle", theme.bold("manifest_frontier"));
  if (args.repo) text += " " + theme.fg("accent", String(args.repo));
  return new Text(text, 0, 0);
};

export const frontierRenderResult = (
  result: any,
  { expanded }: { expanded: boolean },
  theme: any,
  _context: any
) => {
  const frontier = result.details?.frontier;
  if (!frontier || frontier.length === 0) {
    return new Text(theme.fg("muted", "No dispatchable items"), 0, 0);
  }

  let text = theme.fg("success", `✓ ${frontier.length} dispatchable`);

  if (expanded) {
    for (const item of frontier) {
      text += "\n  " + theme.fg("accent", item.id) + theme.fg("dim", ` ${item.name}`);
      if (item.predicted_files?.length > 0) {
        text += theme.fg("muted", ` (${item.predicted_files.length} files)`);
      }
    }
  } else {
    const ids = frontier.map((f: any) => f.id).join(", ");
    text += theme.fg("dim", ` — ${ids}`);
  }

  return new Text(text, 0, 0);
};

// ── manifest_status ──────────────────────────────────────────────────

export const statusRenderCall = (
  _args: Record<string, unknown>,
  theme: any,
  _context: any
) => {
  return new Text(theme.fg("toolTitle", theme.bold("manifest_status")), 0, 0);
};

export const statusRenderResult = (
  result: any,
  { expanded }: { expanded: boolean },
  theme: any,
  _context: any
) => {
  const details = result.details;
  if (!details) {
    return new Text(theme.fg("muted", "No status data"), 0, 0);
  }

  const { byState, total, rollup } = details;

  // Compact: one-line summary
  const done = byState?.done || 0;
  const planned = byState?.planned || 0;
  const inProgress = byState?.in_progress || 0;

  let text = theme.fg("toolTitle", theme.bold(`${total} items`));
  text += " " + theme.fg("success", `${done}✓`);
  text += " " + theme.fg("warning", `${inProgress}⏳`);
  text += " " + theme.fg("dim", `${planned}○`);

  if (expanded && rollup?.length > 0) {
    text += "\n";
    for (const r of rollup) {
      const bar = pctBar(r.done, r.total, 15);
      text += `\n  ${theme.fg("accent", r.name)}`;
      text += `\n    ${theme.fg("dim", bar)} ${theme.fg("muted", `${r.done}/${r.total}`)} ${theme.fg(r.pct === 100 ? "success" : "dim", `${r.pct}%`)}`;
    }
  }

  return new Text(text, 0, 0);
};

// ── manifest_plan ────────────────────────────────────────────────────

export const planRenderCall = (
  args: Record<string, unknown>,
  theme: any,
  _context: any
) => {
  let text = theme.fg("toolTitle", theme.bold("manifest_plan"));
  if (args.format) text += " " + theme.fg("muted", `[${args.format}]`);
  return new Text(text, 0, 0);
};

export const planRenderResult = (
  result: any,
  { expanded }: { expanded: boolean },
  theme: any,
  _context: any
) => {
  const plan = result.details?.plan;
  if (!plan) {
    return new Text(theme.fg("muted", "No plan data"), 0, 0);
  }

  const { summary } = plan;
  let text = theme.fg("toolTitle", theme.bold("Dispatch Plan"));
  text += " " + theme.fg("success", `${summary.dispatchable_now} ready`);
  text += " " + theme.fg("warning", `${summary.blocked_count} blocked`);
  if (summary.human_gate_count > 0) {
    text += " " + theme.fg("error", `${summary.human_gate_count} gated`);
  }

  if (expanded) {
    for (let i = 0; i < plan.parallel_groups.length; i++) {
      const group = plan.parallel_groups[i];
      text += `\n\n  ${theme.fg("accent", `Group ${i + 1}`)} ${theme.fg("muted", `(${group.repo})`)}`;
      for (const node of group.nodes) {
        const fileCount = (node.files_owned?.length || 0) + (node.files_shared?.length || 0);
        text += `\n    ${theme.fg("success", "●")} ${theme.fg("accent", node.id)} ${theme.fg("dim", node.name)}`;
        text += theme.fg("muted", ` ${fileCount} files`);
        if (node.files_forbidden?.length > 0) {
          text += theme.fg("error", ` ⊘${node.files_forbidden.length}`);
        }
      }
      if (group.merge_order) {
        text += `\n    ${theme.fg("warning", "merge:")} ${group.merge_order.join(" → ")}`;
      }
    }

    if (plan.sequential?.length > 0) {
      text += `\n\n  ${theme.fg("warning", "Blocked")}`;
      for (const seq of plan.sequential) {
        text += `\n    ${theme.fg("error", "○")} ${theme.fg("dim", seq.id)} ← ${seq.blocked_by.join(", ")}`;
      }
    }
  } else {
    text += theme.fg("dim", ` (${plan.parallel_groups.length} groups)`);
  }

  return new Text(text, 0, 0);
};

// ── manifest_update ──────────────────────────────────────────────────

export const updateRenderCall = (
  args: Record<string, unknown>,
  theme: any,
  _context: any
) => {
  let text = theme.fg("toolTitle", theme.bold("manifest_update"));
  text += " " + theme.fg("accent", String(args.id || ""));
  text += " → " + theme.fg("warning", String(args.state || ""));
  return new Text(text, 0, 0);
};

export const updateRenderResult = (
  result: any,
  { expanded }: { expanded: boolean },
  theme: any,
  _context: any
) => {
  const d = result.details;
  if (!d?.changed) {
    return new Text(theme.fg("muted", "No changes"), 0, 0);
  }

  const stateColor = d.newState === "done" ? "success" : d.newState === "in_progress" ? "warning" : "dim";
  let text = theme.fg("accent", d.id);
  text += ` ${theme.fg("dim", d.oldState)} → ${theme.fg(stateColor, d.newState)}`;

  if (expanded && d.frontierCount > 0) {
    text += theme.fg("muted", `\n  Frontier: ${d.frontierCount} item(s) ready`);
  }

  return new Text(text, 0, 0);
};

// ── manifest_dispatch ────────────────────────────────────────────────

export const dispatchRenderCall = (
  args: Record<string, unknown>,
  theme: any,
  _context: any
) => {
  let text = theme.fg("toolTitle", theme.bold("manifest_dispatch"));
  if (args.group_index !== undefined) text += " " + theme.fg("accent", `group ${args.group_index}`);
  if (args.mode) text += " " + theme.fg("muted", `[${args.mode}]`);
  return new Text(text, 0, 0);
};

export const dispatchRenderResult = (
  result: any,
  { expanded }: { expanded: boolean },
  theme: any,
  _context: any
) => {
  const d = result.details;
  if (!d?.nodes) {
    return new Text(theme.fg("muted", "No dispatch data"), 0, 0);
  }

  let text = theme.fg("success", `✓ ${d.nodeCount} agent(s) dispatched`);
  text += " " + theme.fg("muted", `(${d.repo})`);

  if (expanded) {
    for (const nodeId of d.nodes) {
      text += `\n  ${theme.fg("warning", "⏳")} ${theme.fg("accent", nodeId)}`;
    }
    if (d.mergeOrder) {
      text += `\n  ${theme.fg("muted", "merge:")} ${d.mergeOrder.join(" → ")}`;
    }
  }

  return new Text(text, 0, 0);
};

// ── manifest_check ───────────────────────────────────────────────────

export const checkRenderCall = (
  args: Record<string, unknown>,
  theme: any,
  _context: any
) => {
  let text = theme.fg("toolTitle", theme.bold("manifest_check"));
  text += " " + theme.fg("accent", String(args.check || "all"));
  return new Text(text, 0, 0);
};

// ── manifest_bootstrap ───────────────────────────────────────────────

export const bootstrapRenderCall = (
  args: Record<string, unknown>,
  theme: any,
  _context: any
) => {
  let text = theme.fg("toolTitle", theme.bold("manifest_bootstrap"));
  const items = (args.work_items as any[])?.length || 0;
  const edges = (args.edges as any[])?.length || 0;
  if (items > 0 || edges > 0) {
    text += " " + theme.fg("dim", `${items} items, ${edges} edges`);
  }
  return new Text(text, 0, 0);
};

export const bootstrapRenderResult = (
  result: any,
  _options: { expanded: boolean },
  theme: any,
  _context: any
) => {
  const d = result.details;
  if (!d) return new Text(theme.fg("muted", "No data"), 0, 0);

  let text = theme.fg("success", `✓ +${d.itemsInserted} items, +${d.edgesInserted} edges`);
  text += theme.fg("dim", ` (${d.totalItems} total, ${d.totalEdges} edges)`);
  return new Text(text, 0, 0);
};
