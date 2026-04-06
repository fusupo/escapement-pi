/**
 * db.ts — SQLite database management for the manifest system.
 *
 * Provides connection management and idempotent schema setup.
 * No harness dependencies — pure TypeScript + better-sqlite3.
 */

import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CORE_DIR = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(CORE_DIR, "schema.sql");

/**
 * Load a SQL query file from the queries/ directory.
 */
export function loadQuery(name: string): string {
  return readFileSync(resolve(CORE_DIR, "queries", `${name}.sql`), "utf-8");
}

/**
 * Create or open a SQLite database at the given path.
 * Pass ":memory:" for in-memory (testing) use.
 * If a directory path is given, appends "manifest.db".
 */
export function createDb(dataDir: string): DatabaseType {
  let dbPath: string;
  if (dataDir === ":memory:") {
    dbPath = ":memory:";
  } else if (dataDir.endsWith(".db")) {
    dbPath = dataDir;
  } else {
    dbPath = resolve(dataDir, "manifest.db");
  }

  // Ensure parent directory exists for file-backed databases
  if (dbPath !== ":memory:") {
    const parentDir = dirname(dbPath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

/**
 * Apply the V2 schema to a SQLite instance.
 * Will error if tables already exist — use ensureSchema for idempotent setup.
 */
export function applySchema(db: DatabaseType): void {
  const sql = readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(sql);
}

/**
 * Idempotent schema setup: only applies if work_items table doesn't exist.
 * Returns true if schema was applied, false if it already existed.
 */
export function ensureSchema(db: DatabaseType): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='work_items'")
    .get() as { name: string } | undefined;
  if (row) {
    return false;
  }
  applySchema(db);
  return true;
}

/**
 * Check if the SQLite connection is healthy.
 */
export function isHealthy(db: DatabaseType): boolean {
  try {
    const row = db.prepare("SELECT 1 AS ok").get() as { ok: number } | undefined;
    return row?.ok === 1;
  } catch {
    return false;
  }
}

/**
 * Check if the manifest schema tables exist.
 */
export function hasSchema(db: DatabaseType): boolean {
  try {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='work_items'")
      .get() as { name: string } | undefined;
    return row !== undefined;
  } catch {
    return false;
  }
}

/**
 * Initialize the manifest database: create/open the SQLite instance
 * and ensure the schema is applied.
 */
export function initManifest(dataDir: string): DatabaseType {
  const db = createDb(dataDir);
  ensureSchema(db);
  return db;
}

/**
 * Helper to parse JSON array strings from SQLite query results.
 * SQLite stores arrays as JSON text — this parses them back.
 */
export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
