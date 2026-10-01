import { spawnSync } from "node:child_process";

const mode = process.argv[2];
if (mode !== "scan" && mode !== "translate") {
  throw new Error("Usage: bun run scripts/run-e2e.ts <scan|translate>");
}

const result = spawnSync(
  process.execPath,
  ["x", "wdio", "run", "wdio.conf.mjs", "--spec", "./tests/e2e/atm10-full-translation.spec.mjs", "--logLevel", "error"],
  {
    env: { ...process.env, MML_SCAN_ONLY: mode === "scan" ? "1" : "0" },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
