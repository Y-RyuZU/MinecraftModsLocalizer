import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const appBinaryPath = process.env.MML_E2E_APP_BINARY || path.join(repoRoot, "src-tauri", "target", "release", "app.exe");
const tauriDriverPort = 45623;
const nativeDriverPort = 4445;

function stopWindowsTauriDriverTree() {
  if (process.platform !== "win32") return;

  // The external driver is spawned through cmd.exe on Windows; killing that
  // shell can leave tauri-driver and msedgedriver alive after WebDriver exits.
  const { stdout, status, error } = spawnSync("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'tauri-driver.exe' -and $_.CommandLine -match '--port ${tauriDriverPort} --native-port ${nativeDriverPort}' } | Select-Object -ExpandProperty ProcessId | ConvertTo-Json -Compress`,
  ], { encoding: "utf8" });
  if (error) throw error;
  if (status !== 0) throw new Error("Could not locate the E2E tauri-driver process tree");

  const output = stdout.trim();
  if (!output) return;
  const pids = JSON.parse(output);
  for (const pid of Array.isArray(pids) ? pids : [pids]) {
    const result = spawnSync("taskkill.exe", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Could not stop E2E tauri-driver process ${pid}`);
  }
}

export const config = {
  specs: ["./tests/e2e/**/*.spec.mjs"],
  maxInstances: 1,
  services: [["@wdio/tauri-service", {
    appBinaryPath,
    driverProvider: "external",
    tauriDriverPort,
    autoInstallTauriDriver: true,
    autoDownloadEdgeDriver: true,
    captureBackendLogs: true,
    captureFrontendLogs: true,
    frontendLogLevel: "error",
    commandTimeout: 300_000,
    startTimeout: 120_000,
  }]],
  capabilities: [{
    browserName: "tauri",
    unhandledPromptBehavior: "ignore",
    "tauri:options": { application: appBinaryPath },
  }],
  framework: "mocha",
  reporters: ["spec"],
  onComplete: stopWindowsTauriDriverTree,
  // Full modpack translations can take hours; do not terminate the live E2E run after 10 minutes.
  mochaOpts: { timeout: 8 * 60 * 60 * 1000 },
  waitforTimeout: 300_000,
  connectionRetryTimeout: 600_000,
  connectionRetryCount: 1,
};
