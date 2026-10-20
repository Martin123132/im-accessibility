'use strict';
// Run only the named non-destructive source tests. Never invoke Codex live smoke.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const mode = process.argv[2] || 'all';
if (!['all','tv','codex'].includes(mode)) {
  console.error('Usage: node scripts/run-tests.cjs [all|tv|codex]');
  process.exit(2);
}
const absolute = rel => path.join(root, ...rel.split('/'));
const codex = [
  'codex-chat-control-pilot-20261012/tests/pilot-safety.test.cjs',
  'codex-chat-control-pilot-20261012/tests/selection-safety.test.cjs'
];
const viewerDir = absolute('tv-reliability-v0.5/viewer/tests');
const tv = [
  'tv-reliability-v0.5/tests/session-policy.test.cjs',
  'tv-reliability-v0.5/tests/release-config.test.cjs',
  'tv-reliability-v0.5/tests/release-runtime-config.test.cjs',
  ...fs.readdirSync(viewerDir).filter(n=>n.endsWith('.test.cjs'))
    .sort().map(n=>'tv-reliability-v0.5/viewer/tests/'+n)
];
const selected = (mode==='codex' ? codex : mode==='tv' ? tv : [...codex,...tv]);
for (const relative of selected) {
  if (!fs.statSync(absolute(relative)).isFile()) throw Error('Missing test file: '+relative);
}
console.log('I’m-accessibility: '+selected.length+' test files ('+mode+'), no live Codex submissions.');
const p = spawnSync(process.execPath, ['--test', ...selected.map(absolute)], {
  cwd:root, stdio:'inherit', windowsHide:true
});
if (p.error) {
  console.error('Could not run Node tests: '+p.error.message);
  process.exit(1);
}
process.exit(p.status===null?1:p.status);
