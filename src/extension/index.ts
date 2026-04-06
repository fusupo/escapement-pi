/**
 * Escapement Pi Extension
 *
 * Registers manifest tools, commands, and lifecycle hooks.
 * SQLite database is initialized on session_start and closed on session_shutdown.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Database } from "better-sqlite3";
import { initManifest, isHealthy, hasSchema } from "../core/db.ts";
import { resolveDataDir, diagnoseDataDir } from "./context-path.ts";
import * as frontierTool from "./tools/manifest-frontier.ts";
import * as statusTool from "./tools/manifest-status.ts";
import * as queryTool from "./tools/manifest-query.ts";
import * as planTool from "./tools/manifest-plan.ts";
import * as updateTool from "./tools/manifest-update.ts";
import * as checkTool from "./tools/manifest-check.ts";
import * as seedTool from "./tools/manifest-seed.ts";
import * as dispatchTool from "./tools/manifest-dispatch.ts";
import * as bootstrapTool from "./tools/manifest-bootstrap.ts";
import * as renderers from "./renderers.ts";
import { convertSessionToMarkdown } from "./session-archive.ts";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

export default function (pi: ExtensionAPI) {
  // ── Shared state ───────────────────────────────────────────────────
  let db: Database | null = null;
  let dataDir: string = "";
  let initError: string | null = null;

  /**
   * Get or create the SQLite connection.
   * Validates health before returning — reconnects if stale.
   */
  function getDb(cwd: string): Database {
    if (db) {
      if (isHealthy(db) && hasSchema(db)) return db;
      try { db.close(); } catch { /* ignore */ }
      db = null;
    }

    dataDir = resolveDataDir(cwd);

    try {
      db = initManifest(dataDir);
      initError = null;
      return db;
    } catch (err) {
      initError = `Failed to connect to manifest at ${dataDir}: ${err}`;
      throw new Error(initError);
    }
  }

  /**
   * Force-reconnect: close existing connection and create a new one.
   */
  function reconnect(cwd: string): string {
    if (db) {
      try { db.close(); } catch { /* ignore */ }
      db = null;
    }

    dataDir = resolveDataDir(cwd);

    try {
      db = initManifest(dataDir);
      initError = null;

      const row = db.prepare("SELECT count(*) AS count FROM work_items").get() as { count: number };
      return `Reconnected to manifest at ${dataDir} (${row.count} work items)`;
    } catch (err) {
      initError = `Reconnect failed: ${err}`;
      throw new Error(initError);
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    try {
      getDb(ctx.cwd);
      const row = db!.prepare("SELECT count(*) AS count FROM work_items").get() as { count: number };
      ctx.ui.notify(`Manifest: ${dataDir} (${row.count} items)`, "info");
    } catch (err) {
      ctx.ui.notify(`Manifest: ${err}`, "warning");
    }
  });

  // ── Pre-compact: snapshot session log to project root ───────────
  // Session logs land in the project working directory (alongside SCRATCHPAD).
  // They get moved to the context-path during archive-work.

  pi.on("session_before_compact", async (event, ctx) => {
    try {
      // Find next available session log number in project root
      let num = 1;
      while (existsSync(resolve(ctx.cwd, `SESSION_LOG_${num}.md`))) num++;

      // Convert current branch entries to markdown
      const entries = ctx.sessionManager.getBranch().map((entry: any) => {
        if (entry.type === "message") {
          return { type: "message", message: entry.message, timestamp: entry.timestamp };
        }
        if (entry.type === "compaction") {
          return { type: "compaction", summary: entry.summary, tokensBefore: entry.tokensBefore };
        }
        return entry;
      });

      let branch = "unknown";
      let codeSha = "unknown";
      try {
        const r1 = await pi.exec("git", ["branch", "--show-current"], { timeout: 5000 });
        if (r1.stdout.trim()) branch = r1.stdout.trim();
        const r2 = await pi.exec("git", ["rev-parse", "--short", "HEAD"], { timeout: 5000 });
        if (r2.stdout.trim()) codeSha = r2.stdout.trim();
      } catch { /* fallback */ }

      const md = convertSessionToMarkdown(entries, {
        branch,
        codeSha,
        sessionId: ctx.sessionManager.getSessionId?.() ?? undefined,
        sessionFile: ctx.sessionManager.getSessionFile?.() ?? undefined,
      });

      const outPath = resolve(ctx.cwd, `SESSION_LOG_${num}.md`);
      writeFileSync(outPath, md, "utf-8");

      ctx.ui.notify(`Session log saved: SESSION_LOG_${num}.md`, "info");
    } catch (err) {
      // Never block compaction
      ctx.ui.notify(`Session archive failed: ${err}`, "warning");
    }
  });

  pi.on("session_shutdown", async () => {
    if (db) {
      try { db.close(); } catch { /* ignore */ }
      db = null;
    }
  });

  // ── Renderer map ───────────────────────────────────────────────────

  const toolRenderers: Record<string, {
    renderCall?: (args: any, theme: any, context: any) => any;
    renderResult?: (result: any, options: any, theme: any, context: any) => any;
  }> = {
    manifest_frontier: { renderCall: renderers.frontierRenderCall, renderResult: renderers.frontierRenderResult },
    manifest_status: { renderCall: renderers.statusRenderCall, renderResult: renderers.statusRenderResult },
    manifest_plan: { renderCall: renderers.planRenderCall, renderResult: renderers.planRenderResult },
    manifest_update: { renderCall: renderers.updateRenderCall, renderResult: renderers.updateRenderResult },
    manifest_dispatch: { renderCall: renderers.dispatchRenderCall, renderResult: renderers.dispatchRenderResult },
    manifest_check: { renderCall: renderers.checkRenderCall },
    manifest_bootstrap: { renderCall: renderers.bootstrapRenderCall, renderResult: renderers.bootstrapRenderResult },
  };

  // ── Helper: register a manifest tool ───────────────────────────────

  function registerManifestTool(
    tool: {
      name: string;
      label: string;
      description: string;
      promptSnippet?: string;
      promptGuidelines?: string[];
      parameters: any;
      execute: (db: Database, params: any, cwd?: string) => any;
    }
  ) {
    const renderer = toolRenderers[tool.name];
    pi.registerTool({
      name: tool.name,
      label: tool.label,
      description: tool.description,
      promptSnippet: tool.promptSnippet,
      promptGuidelines: tool.promptGuidelines,
      parameters: tool.parameters,
      renderCall: renderer?.renderCall,
      renderResult: renderer?.renderResult,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const instance = getDb(ctx.cwd);
        return tool.execute(instance, params, ctx.cwd);
      },
    });
  }

  // ── Tools ──────────────────────────────────────────────────────────

  registerManifestTool(frontierTool);
  registerManifestTool(statusTool);
  registerManifestTool(queryTool);
  registerManifestTool(planTool);
  registerManifestTool(updateTool);
  registerManifestTool(checkTool);
  registerManifestTool(seedTool);
  registerManifestTool(bootstrapTool);

  // Dispatch tool needs access to pi for sendUserMessage
  const dispatchRenderer = toolRenderers[dispatchTool.name];
  pi.registerTool({
    name: dispatchTool.name,
    label: dispatchTool.label,
    description: dispatchTool.description,
    promptSnippet: dispatchTool.promptSnippet,
    promptGuidelines: dispatchTool.promptGuidelines,
    parameters: dispatchTool.parameters,
    renderCall: dispatchRenderer?.renderCall,
    renderResult: dispatchRenderer?.renderResult,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const instance = getDb(ctx.cwd);
      return dispatchTool.execute(instance, params, ctx.cwd, pi);
    },
  });

  // ── Commands ───────────────────────────────────────────────────────

  pi.registerCommand("manifest", {
    description: "Show manifest status overview",
    handler: async (_args, ctx) => {
      try {
        const instance = getDb(ctx.cwd);
        const result = statusTool.execute(instance, {} as Record<string, never>);
        ctx.ui.notify(result.content[0].text, "info");
      } catch (err) {
        ctx.ui.notify(`Manifest error: ${err}`, "error");
      }
    },
  });

  pi.registerCommand("frontier", {
    description: "Show dispatchable work items",
    handler: async (_args, ctx) => {
      try {
        const instance = getDb(ctx.cwd);
        const result = frontierTool.execute(instance, {});
        ctx.ui.notify(result.content[0].text, "info");
      } catch (err) {
        ctx.ui.notify(`Manifest error: ${err}`, "error");
      }
    },
  });

  pi.registerCommand("plan", {
    description: "Generate and display dispatch plan",
    handler: async (_args, ctx) => {
      try {
        const instance = getDb(ctx.cwd);
        const result = planTool.execute(instance, {});
        ctx.ui.notify(result.content[0].text, "info");
      } catch (err) {
        ctx.ui.notify(`Manifest error: ${err}`, "error");
      }
    },
  });

  pi.registerCommand("manifest-reconnect", {
    description: "Force-reconnect to the manifest database",
    handler: async (_args, ctx) => {
      try {
        const msg = reconnect(ctx.cwd);
        ctx.ui.notify(msg, "info");
      } catch (err) {
        ctx.ui.notify(`Reconnect failed: ${err}`, "error");
      }
    },
  });

  pi.registerCommand("manifest-info", {
    description: "Show manifest connection diagnostics",
    handler: async (_args, ctx) => {
      const dir = resolveDataDir(ctx.cwd);
      const diag = diagnoseDataDir(dir);
      const lines = [
        `Data directory: ${dir}`,
        `Connection: ${db ? "active" : "none"}`,
      ];
      if (db) {
        const healthy = isHealthy(db);
        const schema = healthy ? hasSchema(db) : false;
        lines.push(`Health: ${healthy ? "OK" : "STALE"}`);
        lines.push(`Schema: ${schema ? "OK" : "MISSING"}`);
      }
      if (diag) lines.push(`Diagnostic: ${diag}`);
      if (initError) lines.push(`Last error: ${initError}`);
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
