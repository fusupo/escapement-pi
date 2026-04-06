/**
 * context-path.ts — Resolve the manifest database location.
 *
 * Resolution order:
 * 1. MANIFEST_DATA_DIR environment variable
 * 2. context-path from AGENTS.md / CLAUDE.md (if parseable)
 * 3. Default: .manifest/ in cwd
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Attempt to parse a context-path from an AGENTS.md or CLAUDE.md file.
 */
function parseContextPath(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, "utf-8");
    const match = content.match(/\*\*context-path\*\*:\s*(.+)/i);
    if (match) return match[1].trim();
  } catch { /* ignore */ }
  return null;
}

/**
 * Resolve the manifest database directory.
 * Returns a directory path — manifest.db will be inside it.
 */
export function resolveDataDir(cwd: string): string {
  if (process.env.MANIFEST_DATA_DIR) {
    return resolve(process.env.MANIFEST_DATA_DIR);
  }

  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    const contextPath = parseContextPath(join(cwd, name));
    if (contextPath) {
      return resolve(cwd, contextPath, "manifest");
    }
  }

  return resolve(cwd, ".manifest");
}

/**
 * Resolve the full database file path.
 */
export function resolveDbPath(cwd: string): string {
  return resolve(resolveDataDir(cwd), "manifest.db");
}

/**
 * Check if the data directory looks healthy.
 */
export function diagnoseDataDir(dataDir: string): string | null {
  if (!existsSync(dataDir)) {
    return `Directory does not exist: ${dataDir} (will be created on first use)`;
  }
  const dbPath = resolve(dataDir, "manifest.db");
  if (!existsSync(dbPath)) {
    return `No manifest.db in ${dataDir} (will be created on first use)`;
  }
  return null;
}
