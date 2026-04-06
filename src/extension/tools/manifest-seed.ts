/**
 * manifest_seed tool — Load a SQL seed file into the manifest database.
 */

import { Type } from "@sinclair/typebox";
import type { Database } from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasSchema } from "../../core/db.ts";

export const name = "manifest_seed";
export const label = "Manifest Seed";
export const description =
  "Load a SQL seed file into the manifest database.";
export const promptSnippet =
  "Load a SQL seed file into the manifest database";

export const parameters = Type.Object({
  file: Type.String({ description: "Path to SQL seed file" }),
});

export function execute(
  db: Database,
  params: { file: string },
  cwd: string
): { content: { type: "text"; text: string }[]; details: Record<string, unknown> } {
  if (!hasSchema(db)) {
    throw new Error("Manifest schema not found. Try /manifest-reconnect to reinitialize.");
  }

  const filePath = resolve(cwd, params.file);
  let sql: string;
  try { sql = readFileSync(filePath, "utf-8"); }
  catch { throw new Error(`Cannot read seed file: ${filePath}`); }

  db.exec(sql);

  const itemCount = (db.prepare("SELECT count(*) AS count FROM work_items").get() as { count: number }).count;
  const edgeCount = (db.prepare("SELECT count(*) AS count FROM edges").get() as { count: number }).count;

  return {
    content: [{ type: "text", text: `Seed applied from \`${params.file}\`.\n- work_items: ${itemCount}\n- edges: ${edgeCount}` }],
    details: { file: params.file, workItems: itemCount, edges: edgeCount },
  };
}
