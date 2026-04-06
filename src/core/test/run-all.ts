/**
 * Run all manifest core tests in sequence.
 */

import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const tests = [
  "schema.test.ts",
  "queries.test.ts",
  "planner.test.ts",
  "seed.test.ts",
  "check.test.ts",
  "cli.test.ts",
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  const testPath = resolve(__dirname, test);
  console.log(`\n${"═".repeat(60)}`);
  console.log(`Running: ${test}`);
  console.log("═".repeat(60));

  try {
    execSync(`node --import tsx "${testPath}"`, {
      stdio: "inherit",
      cwd: resolve(__dirname, "../../.."),
    });
    passed++;
  } catch {
    failed++;
    console.error(`\n❌ ${test} FAILED\n`);
  }
}

console.log(`\n${"═".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${tests.length} total`);
console.log("═".repeat(60));

if (failed > 0) process.exit(1);
