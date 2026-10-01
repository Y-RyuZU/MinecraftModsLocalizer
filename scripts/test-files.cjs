const fs = require('node:fs');
const path = require('node:path');
const suites = { bun: [], vitest: [], jest: [] };
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) visit(filename);
    else if (/\.(test|spec)\.[jt]sx?$/.test(filename)) {
      const source = fs.readFileSync(filename, 'utf8');
      const runner = /from ['"]bun:test['"]/.test(source) ? 'bun'
        : /from ['"]vitest['"]/.test(source) ? 'vitest' : 'jest';
      suites[runner].push(filename);
    }
  }
}
visit('src');
module.exports = suites;
