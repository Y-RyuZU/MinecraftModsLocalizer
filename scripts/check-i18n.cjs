// Run with node scripts/check-i18n.cjs. Uses the project's TypeScript parser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function flatten(value, prefix = '') {
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) =>
    typeof entry === 'string' ? [[prefix + key, entry]] : Object.entries(flatten(entry, `${prefix}${key}.`))));
}
const locales = fs.readdirSync('public/locales');
const dictionaries = Object.fromEntries(locales.map(locale => [locale,
  flatten(JSON.parse(fs.readFileSync(`public/locales/${locale}/common.json`, 'utf8')))]));
const reference = dictionaries.en;
const placeholders = text => [...text.matchAll(/{{\s*([^}]+?)\s*}}/g)].map(match => match[1]).sort();
for (const [locale, dictionary] of Object.entries(dictionaries)) {
  assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(reference).sort(), `${locale}: translation keys differ`);
  for (const [key, value] of Object.entries(dictionary)) {
    assert.ok(value.trim(), `${locale}: empty ${key}`);
    assert.deepEqual(placeholders(value), placeholders(reference[key]), `${locale}: interpolation differs in ${key}`);
  }
}

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? (entry.name === '__tests__' ? [] : files(filename)) : [filename];
  });
}
function checkKey(key, file) {
  assert.ok(Object.hasOwn(reference, key), `${file}: missing translation ${key}`);
}
for (const file of files('src').filter(file => /\.tsx?$/.test(file))) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCallExpression(node) && ['t', 'i18n.t'].includes(node.expression.getText(source))) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) checkKey(argument.text, file);
      if (argument && ts.isConditionalExpression(argument)) {
        for (const branch of [argument.whenTrue, argument.whenFalse]) {
          if (ts.isStringLiteral(branch)) checkKey(branch.text, file);
        }
      }
    }
    if (ts.isJsxText(node) && /[a-zA-Z\u3040-\u9fff]/.test(node.text)) {
      // Version prefix is language-independent; visible prose belongs in the dictionaries.
      assert.equal(node.text.trim(), 'v', `${file}: untranslated JSX text ${node.text.trim()}`);
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'label' && ts.isStringLiteral(node.initializer)) {
      if (node.initializer.text.startsWith('tables.')) checkKey(node.initializer.text, file);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
console.log(`i18n: ${locales.length} dictionaries, keys, interpolation and static UI text checked`);
