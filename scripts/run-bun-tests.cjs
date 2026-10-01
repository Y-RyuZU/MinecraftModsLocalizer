const { spawnSync } = require('node:child_process');
const { bun } = require('./test-files.cjs');
let failed = 0;
// Module mocks are global in Bun. Separate processes prevent one suite changing another's imports.
for (const file of bun) {
  const result = spawnSync(process.execPath, ['test', file], { stdio: 'inherit', timeout: 120000 });
  if (result.error) console.error(file, result.error.message);
  if (result.error || result.status !== 0) failed++;
}
console.log(`Bun suites: ${bun.length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
